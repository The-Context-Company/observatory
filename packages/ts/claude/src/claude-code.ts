import {
  debugLog,
  enrichClaudeMessage,
  resolveTCCConfig,
  sendToClaudeIngestion,
  type SDKMessage,
  type TCCConfig,
} from "./core";

const ANSI_ESCAPE_REGEX =
  // Strip terminal control sequences so PTY output can be parsed safely.
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape matcher
  /\u001b(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;

export type ClaudeCodeStreamChunk = string | Uint8Array;

export type ClaudeCodeStreamOptions = {
  /**
   * TCC tracing configuration for the collected run.
   */
  tcc?: TCCConfig;
  /**
   * Original prompt passed to `claude -p`, if available.
   */
  userPrompt?: string | null;
  /**
   * Optional callback fired for every parsed Claude Code message.
   */
  onMessage?: (message: SDKMessage) => void;
};

export type ClaudeCodeStreamResult = {
  runId: string;
  sessionId: string | null;
  userPrompt: string | null;
  messages: SDKMessage[];
  parsedMessages: number;
  ignoredLines: number;
};

function stripAnsi(text: string): string {
  return text.replace(ANSI_ESCAPE_REGEX, "");
}

function normalizeLine(line: string): string {
  let normalized = stripAnsi(line).trim();

  if (normalized.startsWith("data:")) {
    normalized = normalized.slice("data:".length).trim();
  }

  return normalized;
}

function tryParseClaudeMessage(line: string): SDKMessage | null {
  const normalized = normalizeLine(line);
  if (!normalized) return null;

  const candidates = [normalized];

  const firstBrace = normalized.indexOf("{");
  const lastBrace = normalized.lastIndexOf("}");
  if (firstBrace > 0 && lastBrace > firstBrace) {
    candidates.push(normalized.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (
        parsed &&
        typeof parsed === "object" &&
        "type" in parsed &&
        typeof parsed.type === "string"
      ) {
        return parsed as SDKMessage;
      }
    } catch {
      // Ignore parse failures until all candidates are exhausted.
    }
  }

  return null;
}

/**
 * Incrementally collects Claude Code `--output-format stream-json` output and
 * forwards the parsed messages to TCC's Claude ingestion endpoint.
 *
 * This is designed for PTY-based environments like Daytona, where shell echoes
 * and ANSI control codes may be interleaved with newline-delimited JSON.
 */
export class ClaudeCodeStreamCollector {
  private readonly onMessage?: (message: SDKMessage) => void;
  private readonly decoder = new TextDecoder();
  private readonly runId: string;
  private readonly sessionId: string | null;
  private readonly metadata: Record<string, unknown>;
  private readonly userPrompt: string | null;

  private buffer = "";
  private finished = false;
  private parsedMessages = 0;
  private ignoredLines = 0;
  private readonly messages: SDKMessage[] = [];

  constructor(options: ClaudeCodeStreamOptions = {}) {
    const resolvedTcc = resolveTCCConfig(options.tcc);

    this.runId = resolvedTcc.runId;
    this.sessionId = resolvedTcc.sessionId;
    this.metadata = resolvedTcc.metadata;
    this.userPrompt = options.userPrompt ?? null;
    this.onMessage = options.onMessage;

    debugLog("ClaudeCodeStreamCollector initialized");
    debugLog("runId:", this.runId);
    debugLog("sessionId:", this.sessionId);
    debugLog("metadata:", this.metadata);
  }

  private ensureOpen(): void {
    if (this.finished) {
      throw new Error("[TCC] ClaudeCodeStreamCollector already finished");
    }
  }

  private addMessage(message: SDKMessage): SDKMessage {
    const enriched = enrichClaudeMessage(message, {
      runId: this.runId,
      sessionId: this.sessionId,
    });

    this.messages.push(enriched);
    this.parsedMessages += 1;
    this.onMessage?.(enriched);
    debugLog(`Collected Claude Code message type: ${enriched.type}`);

    return enriched;
  }

  private processLine(line: string): SDKMessage | null {
    const normalized = normalizeLine(line);
    if (!normalized) return null;

    const message = tryParseClaudeMessage(normalized);
    if (!message) {
      this.ignoredLines += 1;
      debugLog("Ignored non-JSON Claude Code line", normalized);
      return null;
    }

    return this.addMessage(message);
  }

  /**
   * Ingests a raw PTY/stdout chunk. Returns any Claude messages parsed from the
   * chunk after line buffering is applied.
   */
  ingest(chunk: ClaudeCodeStreamChunk): SDKMessage[] {
    this.ensureOpen();

    const text =
      typeof chunk === "string"
        ? chunk
        : this.decoder.decode(chunk, { stream: true });

    this.buffer += text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    const parsedMessages: SDKMessage[] = [];

    while (true) {
      const newlineIndex = this.buffer.indexOf("\n");
      if (newlineIndex === -1) break;

      const line = this.buffer.slice(0, newlineIndex);
      this.buffer = this.buffer.slice(newlineIndex + 1);

      const message = this.processLine(line);
      if (message) parsedMessages.push(message);
    }

    return parsedMessages;
  }

  /**
   * Returns a copy of the currently collected Claude messages.
   */
  getMessages(): SDKMessage[] {
    return [...this.messages];
  }

  /**
   * Finalizes the collector, parses any trailing buffered line, and sends the
   * collected Claude messages to the existing TCC Claude ingestion endpoint.
   */
  async finish(): Promise<ClaudeCodeStreamResult> {
    this.ensureOpen();
    this.finished = true;

    this.buffer += this.decoder.decode();

    if (this.buffer.length > 0) {
      this.processLine(this.buffer);
      this.buffer = "";
    }

    if (this.messages.length > 0) {
      await sendToClaudeIngestion({
        messages: this.messages,
        customMetadata: this.metadata,
        runId: this.runId,
        sessionId: this.sessionId,
        userPrompt: this.userPrompt,
      });
    } else {
      debugLog("No Claude Code messages collected; skipping ingestion");
    }

    return {
      runId: this.runId,
      sessionId: this.sessionId,
      userPrompt: this.userPrompt,
      messages: [...this.messages],
      parsedMessages: this.parsedMessages,
      ignoredLines: this.ignoredLines,
    };
  }
}

/**
 * Convenience helper for one-shot collection from an async source of
 * `stream-json` chunks, such as a Daytona PTY or child process stdout stream.
 */
export async function collectClaudeCodeStream(
  source: AsyncIterable<ClaudeCodeStreamChunk>,
  options: ClaudeCodeStreamOptions = {}
): Promise<ClaudeCodeStreamResult> {
  const collector = new ClaudeCodeStreamCollector(options);

  for await (const chunk of source) {
    collector.ingest(chunk);
  }

  return collector.finish();
}

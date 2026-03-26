import { createSender } from "./sender";
import { debug, setDebug } from "./logger";
import type {
  TCCPiConfig,
  RunRecord,
  StepRecord,
  ToolCallRecord,
  BatchPayload,
  RunPayload,
  StepPayload,
  ToolCallPayload,
} from "./types";

// ---------------------------------------------------------------------------
// Pi Agent SDK types (declared locally to avoid hard runtime dependency)
//
// These mirror the event types from @mariozechner/pi-agent-core and
// @mariozechner/pi-ai. We only use the shapes we need, keeping the
// peer dependency optional at the type level.
// ---------------------------------------------------------------------------

/** Minimal shape of an AgentSession — only the subscribe method. */
interface PiAgentSession {
  subscribe(listener: (event: PiAgentEvent) => void): () => void;
}

/** Minimal event shape — we narrow on `type` at runtime. */
type PiAgentEvent = {
  type: string;
  // Known optional fields across event types
  messages?: PiMessage[];
  message?: PiMessage;
  toolResults?: PiToolResultMessage[];
  assistantMessageEvent?: unknown;
  toolCallId?: string;
  toolName?: string;
  args?: unknown;
  partialResult?: unknown;
  result?: unknown;
  isError?: boolean;
  [key: string]: unknown;
};

/** Minimal message shape — covers user, assistant, and toolResult roles. */
interface PiMessage {
  role: string;
  content: unknown;
  // Assistant-specific fields
  model?: string;
  provider?: string;
  usage?: PiUsage;
  stopReason?: string;
  errorMessage?: string;
  timestamp?: number;
}

interface PiToolResultMessage {
  role: "toolResult";
  toolCallId: string;
  toolName: string;
  content: unknown;
  isError: boolean;
  timestamp: number;
}

interface PiUsage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  cost: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
  };
}

// ---------------------------------------------------------------------------
// Content extraction helpers
// ---------------------------------------------------------------------------

/**
 * Extract text from a message's content.
 * Pi messages can have string content or an array of content blocks.
 */
function extractTextFromContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  const texts: string[] = [];
  for (const block of content) {
    if (typeof block === "string") {
      texts.push(block);
    } else if (block && typeof block === "object") {
      const b = block as Record<string, unknown>;
      if (b.type === "text" && typeof b.text === "string") {
        texts.push(b.text);
      }
    }
  }
  return texts.join("");
}

/**
 * Find the last user message content from an array of messages.
 */
function findLastUserPrompt(messages: PiMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      return extractTextFromContent(messages[i].content);
    }
  }
  return "";
}

/**
 * Find the last assistant message text from an array of messages.
 */
function findLastAssistantResponse(messages: PiMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "assistant") {
      return extractTextFromContent(messages[i].content);
    }
  }
  return "";
}

function safeStringify(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function msToIso(ms: number): string {
  return new Date(ms).toISOString();
}

// ---------------------------------------------------------------------------
// Payload builders
// ---------------------------------------------------------------------------

function buildRunPayload(run: RunRecord, config: TCCPiConfig): RunPayload {
  const attrs: Record<string, unknown> = {
    "pi.framework": "pi-mono",
  };

  const payload: RunPayload = {
    type: "run",
    run_id: run.runId,
    start_time: msToIso(run.startTimeMs),
    end_time: msToIso(run.endTimeMs ?? Date.now()),
    prompt: { user_prompt: run.userPrompt },
    status_code: run.hasError ? 2 : 0,
    attributes: attrs,
  };

  if (run.response) payload.response = run.response;
  if (run.errorMessage) payload.status_message = run.errorMessage;
  if (config.sessionId) payload.session_id = config.sessionId;
  if (config.conversational !== undefined)
    payload.conversational = config.conversational;
  if (config.metadata) payload.metadata = config.metadata;

  return payload;
}

function buildStepPayload(step: StepRecord, runId: string): StepPayload {
  const attrs: Record<string, unknown> = {
    "pi.provider": step.provider,
    "pi.stop_reason": step.stopReason,
    "pi.duration_ms": step.endTimeMs - step.startTimeMs,
  };

  const uncachedTokens = step.usage.input - step.usage.cacheRead;

  const payload: StepPayload = {
    type: "step",
    run_id: runId,
    step_id: step.stepId,
    start_time: msToIso(step.startTimeMs),
    end_time: msToIso(step.endTimeMs),
    prompt: step.prompt,
    response: step.response,
    status_code: step.stopReason === "error" || step.stopReason === "aborted" ? 2 : 0,
    model_requested: step.model,
    model_used: step.model,
    finish_reason: step.stopReason,
    prompt_uncached_tokens: uncachedTokens >= 0 ? uncachedTokens : step.usage.input,
    prompt_cached_tokens: step.usage.cacheRead,
    completion_tokens: step.usage.output,
    attributes: attrs,
  };

  if (step.usage.cost > 0) payload.real_total_cost = step.usage.cost;
  if (step.errorMessage) payload.status_message = step.errorMessage;

  return payload;
}

function buildToolCallPayload(
  tc: ToolCallRecord,
  runId: string
): ToolCallPayload {
  const durationMs =
    tc.endTimeMs !== undefined ? tc.endTimeMs - tc.startTimeMs : 0;

  const attrs: Record<string, unknown> = {
    "pi.duration_ms": durationMs,
  };

  const payload: ToolCallPayload = {
    type: "tool_call",
    run_id: runId,
    tool_call_id: tc.toolCallId,
    tool_name: tc.toolName,
    start_time: msToIso(tc.startTimeMs),
    end_time: msToIso(tc.endTimeMs ?? Date.now()),
    status_code: tc.isError ? 2 : 0,
    attributes: attrs,
  };

  if (tc.args !== undefined) payload.args = safeStringify(tc.args);
  if (tc.result !== undefined) payload.result = safeStringify(tc.result);

  return payload;
}

function buildBatch(run: RunRecord, config: TCCPiConfig): BatchPayload {
  const items: (RunPayload | StepPayload | ToolCallPayload)[] = [];

  items.push(buildRunPayload(run, config));

  for (const step of run.steps) {
    items.push(buildStepPayload(step, run.runId));
  }

  for (const tc of run.toolCalls) {
    items.push(buildToolCallPayload(tc, run.runId));
  }

  return { type: "batch", items };
}

// ---------------------------------------------------------------------------
// Main instrumentation function
// ---------------------------------------------------------------------------

/**
 * Instrument a Pi Agent session for observability with The Context Company.
 *
 * This function subscribes to the session's event stream and automatically
 * collects telemetry (runs, LLM steps, tool calls) which is sent to TCC's
 * API after each agent run completes.
 *
 * The instrumentation is completely non-invasive — it only calls
 * `session.subscribe()` and never modifies agent behavior.
 *
 * @param session - A Pi `AgentSession` instance (from `createAgentSession()`)
 * @param config - Optional TCC configuration
 * @returns An `unsubscribe` function to stop collecting telemetry
 *
 * @example
 * ```ts
 * import { createAgentSession } from '@mariozechner/pi-coding-agent';
 * import { instrumentPiSession } from '@contextcompany/pi';
 *
 * const { session } = await createAgentSession();
 * const unsub = instrumentPiSession(session, {
 *   sessionId: 'conversation-123',
 *   debug: true,
 * });
 *
 * await session.prompt('What files are in the current directory?');
 * // → TCC automatically receives run + steps + tool calls
 *
 * // Later, to stop:
 * unsub();
 * ```
 */
export function instrumentPiSession(
  session: PiAgentSession,
  config: TCCPiConfig = {}
): () => void {
  if (config.debug) setDebug(true);

  const send = createSender({
    apiKey: config.apiKey,
    endpoint: config.endpoint,
  });

  // Mutable state for the current run
  let currentRun: RunRecord | null = null;
  let lastUserPrompt = "";
  let stepCounter = 0;

  const listener = (event: PiAgentEvent) => {
    switch (event.type) {
      case "agent_start": {
        stepCounter = 0;
        currentRun = {
          runId: config.runId ?? crypto.randomUUID(),
          startTimeMs: Date.now(),
          userPrompt: "",
          response: "",
          hasError: false,
          steps: [],
          toolCalls: [],
        };
        debug("Agent run started", { runId: currentRun.runId });
        break;
      }

      case "message_start": {
        const msg = event.message;
        if (msg && msg.role === "user") {
          lastUserPrompt = extractTextFromContent(msg.content);
          if (currentRun && !currentRun.userPrompt) {
            currentRun.userPrompt = lastUserPrompt;
          }
        }
        break;
      }

      case "message_end": {
        if (!currentRun) break;
        const msg = event.message;
        if (!msg) break;

        if (msg.role === "assistant" && msg.usage) {
          const usage = msg.usage as PiUsage;
          const stepId = `step_${++stepCounter}`;
          const endTimeMs = typeof msg.timestamp === "number" ? msg.timestamp : Date.now();

          const step: StepRecord = {
            stepId,
            model: typeof msg.model === "string" ? msg.model : "unknown",
            provider: typeof msg.provider === "string" ? msg.provider : "unknown",
            prompt: lastUserPrompt,
            response: extractTextFromContent(msg.content),
            startTimeMs: endTimeMs,
            endTimeMs,
            stopReason: typeof msg.stopReason === "string" ? msg.stopReason : "stop",
            errorMessage: typeof msg.errorMessage === "string" ? msg.errorMessage : undefined,
            usage: {
              input: usage.input,
              output: usage.output,
              cacheRead: usage.cacheRead,
              cacheWrite: usage.cacheWrite,
              totalTokens: usage.totalTokens,
              cost: usage.cost.total,
            },
          };

          currentRun.steps.push(step);
          currentRun.response = step.response;

          if (step.stopReason === "error" || step.stopReason === "aborted") {
            currentRun.hasError = true;
            currentRun.errorMessage = step.errorMessage;
          }

          debug(`Step recorded: ${step.model} (${usage.input}+${usage.output} tokens)`);
        }
        break;
      }

      case "tool_execution_start": {
        if (!currentRun) break;

        const tc: ToolCallRecord = {
          toolCallId: event.toolCallId ?? crypto.randomUUID(),
          toolName: event.toolName ?? "unknown",
          args: event.args,
          startTimeMs: Date.now(),
          isError: false,
        };

        currentRun.toolCalls.push(tc);
        debug(`Tool started: ${tc.toolName}`);
        break;
      }

      case "tool_execution_end": {
        if (!currentRun) break;

        const toolCallId = event.toolCallId;
        // Find the matching tool call record
        const tc = currentRun.toolCalls.find(
          (t) => t.toolCallId === toolCallId && t.endTimeMs === undefined
        );

        if (tc) {
          tc.endTimeMs = Date.now();
          tc.result = event.result;
          tc.isError = event.isError === true;
          debug(`Tool ended: ${tc.toolName} (error: ${tc.isError})`);
        }
        break;
      }

      case "agent_end": {
        if (!currentRun) break;

        currentRun.endTimeMs = Date.now();

        // If we didn't capture the user prompt from message events,
        // try to extract from the final messages array
        if (!currentRun.userPrompt && Array.isArray(event.messages)) {
          currentRun.userPrompt = findLastUserPrompt(event.messages);
        }

        // If we didn't capture the response, try from messages
        if (!currentRun.response && Array.isArray(event.messages)) {
          currentRun.response = findLastAssistantResponse(event.messages);
        }

        debug(
          `Agent run ended: ${currentRun.steps.length} step(s), ${currentRun.toolCalls.length} tool call(s)`
        );

        // Build and send the batch
        const batch = buildBatch(currentRun, config);

        send(batch).catch((err) =>
          console.error("[TCC Pi] Error sending telemetry:", err)
        );

        currentRun = null;
        break;
      }

      // Ignored events
      case "turn_start":
      case "turn_end":
      case "message_update":
      case "tool_execution_update":
        break;

      default:
        // Session-specific events (auto_compaction_*, auto_retry_*, etc.)
        break;
    }
  };

  // Subscribe to the session
  const unsubscribe = session.subscribe(listener as (event: unknown) => void);
  debug("Instrumentation active");

  return unsubscribe;
}

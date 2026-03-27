import { debug, setDebug } from "./logger";
import { createSender } from "./sender";
import type { TCCPiConfig } from "./types";

interface PiAgentSession {
  subscribe(listener: (event: PiAgentEvent) => void): () => void;
}

type PiAgentEvent = {
  type: string;
  messages?: unknown[];
  message?: unknown;
  toolResults?: unknown[];
  assistantMessageEvent?: unknown;
  toolCallId?: string;
  toolName?: string;
  args?: unknown;
  partialResult?: unknown;
  result?: unknown;
  isError?: boolean;
  [key: string]: unknown;
};

type RawToolExecution = {
  toolCallId: string | undefined;
  toolName: string;
  args: unknown;
  result?: unknown;
  isError: boolean;
  startTimestamp: number;
  endTimestamp?: number;
};

export type PiInstrumentation = {
  unsubscribe: () => void;
  getLastRunId: () => string | null;
  setRunId: (id: string) => void;
};

export function instrumentPiSession(
  session: PiAgentSession,
  config: TCCPiConfig = {}
): PiInstrumentation {
  if (config.debug) setDebug(true);

  const send = createSender({
    apiKey: config.apiKey,
    endpoint: config.endpoint,
  });

  let runId: string | null = null;
  let lastRunId: string | null = null;
  let nextRunId: string | null = null;
  let startTimestamp: number | null = null;
  let messages: unknown[] = [];
  let toolExecutions: RawToolExecution[] = [];

  const listener = (event: PiAgentEvent) => {
    switch (event.type) {
      case "agent_start": {
        runId = nextRunId ?? config.runId ?? crypto.randomUUID();
        nextRunId = null;
        lastRunId = runId;
        startTimestamp = Date.now();
        messages = [];
        toolExecutions = [];
        debug("Agent run started", { runId });
        break;
      }

      case "message_end": {
        if (!runId) break;
        if (event.message) {
          messages.push(event.message);
          debug("Message collected", { role: (event.message as any).role });
        }
        break;
      }

      case "tool_execution_start": {
        if (!runId) break;
        toolExecutions.push({
          toolCallId: event.toolCallId,
          toolName: event.toolName ?? "unknown",
          args: event.args,
          isError: false,
          startTimestamp: Date.now(),
        });
        debug(`Tool started: ${event.toolName}`);
        break;
      }

      case "tool_execution_end": {
        if (!runId) break;
        const tc = toolExecutions.find(
          (t) =>
            t.toolCallId === event.toolCallId && t.endTimestamp === undefined
        );
        if (tc) {
          tc.endTimestamp = Date.now();
          tc.result = event.result;
          tc.isError = event.isError === true;
          debug(`Tool ended: ${tc.toolName} (error: ${tc.isError})`);
        }
        break;
      }

      case "agent_end": {
        if (!runId) break;

        const endTimestamp = Date.now();
        const finalMessages =
          messages.length > 0 ? messages : (event.messages ?? []);

        const payload = {
          runId,
          startTimestamp: startTimestamp!,
          endTimestamp,
          messages: finalMessages,
          toolExecutions,
          sessionId: config.sessionId,
          conversational: config.conversational,
          metadata: config.metadata,
        };

        debug(
          `Agent run ended: ${finalMessages.length} message(s), ${toolExecutions.length} tool execution(s)`
        );

        send(payload).catch((err) =>
          console.error("[TCC Pi] Error sending telemetry:", err)
        );

        runId = null;
        startTimestamp = null;
        messages = [];
        toolExecutions = [];
        break;
      }

      case "turn_start":
      case "turn_end":
      case "message_start":
      case "message_update":
      case "tool_execution_update":
        break;

      default:
        break;
    }
  };

  const unsubscribe = session.subscribe(listener as (event: unknown) => void);
  debug("Instrumentation active");

  return {
    unsubscribe,
    getLastRunId: () => lastRunId,
    setRunId: (id: string) => {
      nextRunId = id;
    },
  };
}

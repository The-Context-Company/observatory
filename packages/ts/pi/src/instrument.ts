import { createSender } from "./sender";
import { debug, setDebug } from "./logger";
import type { TCCPiConfig } from "./types";

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

/** Raw tool execution record collected during a run. */
type RawToolExecution = {
  toolCallId: string;
  toolName: string;
  args: unknown;
  result?: unknown;
  isError: boolean;
  startTimestamp: number;
  endTimestamp?: number;
};

// ---------------------------------------------------------------------------
// Main instrumentation function
// ---------------------------------------------------------------------------

/**
 * Instrument a Pi Agent session for observability with The Context Company.
 *
 * This function subscribes to the session's event stream and forwards
 * raw Pi events to TCC's API after each agent run completes. All
 * processing and conversion happens server-side.
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
 * // → TCC automatically receives raw Pi events
 *
 * // Later, to stop:
 * unsub();
 * ```
 */
export type PiInstrumentation = {
  /** Stop collecting telemetry. */
  unsubscribe: () => void;
  /** Get the run ID of the most recently completed (or in-progress) run. */
  getLastRunId: () => string | null;
  /** Set the run ID for the next prompt. If not set, a random ID is generated. */
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

  // Mutable state for the current run
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
        // Collect the raw message as-is from Pi
        if (event.message) {
          messages.push(event.message);
          debug("Message collected", { role: (event.message as any).role });
        }
        break;
      }

      case "tool_execution_start": {
        if (!runId) break;
        toolExecutions.push({
          toolCallId: event.toolCallId ?? crypto.randomUUID(),
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
          (t) => t.toolCallId === event.toolCallId && t.endTimestamp === undefined
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

        // If we didn't capture messages from message_end events,
        // use the messages array from agent_end
        const finalMessages = messages.length > 0
          ? messages
          : (event.messages ?? []);

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

        // Reset state
        runId = null;
        startTimestamp = null;
        messages = [];
        toolExecutions = [];
        break;
      }

      // Ignored events — streaming deltas, turns, session management
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
    setRunId: (id: string) => { nextRunId = id; },
  };
}

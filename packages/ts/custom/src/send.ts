import type { RunInput, StepInput, ToolCallInput, ModelConfig } from "./types";
import { send, debug } from "./transport";

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function stringify(
  value: string | Record<string, unknown> | unknown[]
): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function resolveModel(model: ModelConfig): {
  requested?: string;
  used?: string;
} {
  if (typeof model === "string") return { requested: model, used: model };
  return model;
}

function buildRunPayload(
  input: RunInput,
  runId: string
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    type: "run",
    run_id: runId,
    start_time: toIso(input.startTime),
    end_time: toIso(input.endTime),
    prompt: input.prompt,
    status_code: input.statusCode ?? 0,
  };

  if (input.sessionId !== undefined) payload.session_id = input.sessionId;
  if (input.conversational !== undefined)
    payload.conversational = input.conversational;
  if (input.response !== undefined) payload.response = input.response;
  if (input.statusMessage !== undefined)
    payload.status_message = input.statusMessage;
  if (input.metadata !== undefined) payload.metadata = input.metadata;

  return payload;
}

function buildStepPayload(
  input: StepInput,
  runId: string
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    type: "step",
    run_id: runId,
    step_id: input.stepId ?? crypto.randomUUID(),
    start_time: toIso(input.startTime),
    end_time: toIso(input.endTime),
    prompt: input.prompt,
    response: input.response,
    status_code: input.statusCode ?? 0,
  };

  if (input.statusMessage !== undefined)
    payload.status_message = input.statusMessage;

  if (input.model !== undefined) {
    const { requested, used } = resolveModel(input.model);
    if (requested !== undefined) payload.model_requested = requested;
    if (used !== undefined) payload.model_used = used;
  }

  if (input.finishReason !== undefined)
    payload.finish_reason = input.finishReason;
  if (input.tokens?.uncached !== undefined)
    payload.prompt_uncached_tokens = input.tokens.uncached;
  if (input.tokens?.cached !== undefined)
    payload.prompt_cached_tokens = input.tokens.cached;
  if (input.tokens?.completion !== undefined)
    payload.completion_tokens = input.tokens.completion;
  if (input.cost !== undefined) payload.real_total_cost = input.cost;
  if (input.toolDefinitions !== undefined)
    payload.tool_definitions = stringify(input.toolDefinitions);

  return payload;
}

function buildToolCallPayload(
  input: ToolCallInput,
  runId: string
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    type: "tool_call",
    run_id: runId,
    tool_call_id: input.toolCallId ?? crypto.randomUUID(),
    tool_name: input.name,
    start_time: toIso(input.startTime),
    end_time: toIso(input.endTime),
    status_code: input.statusCode ?? 0,
  };

  if (input.statusMessage !== undefined)
    payload.status_message = input.statusMessage;
  if (input.args !== undefined) payload.args = stringify(input.args);
  if (input.result !== undefined) payload.result = stringify(input.result);

  return payload;
}

/**
 * Send a complete run (with optional nested steps and tool calls) in a single
 * request. Use this when all data is already available.
 *
 * ```ts
 * await sendRun({
 *   prompt: { user_prompt: "What's the weather?" },
 *   response: "72°F in SF",
 *   startTime: new Date("2025-01-01T00:00:00Z"),
 *   endTime:   new Date("2025-01-01T00:00:01Z"),
 *   steps: [{ prompt: "...", response: "...", model: "gpt-4o", ... }],
 * });
 * ```
 */
export async function sendRun(input: RunInput): Promise<void> {
  const runId = input.runId ?? crypto.randomUUID();
  const runPayload = buildRunPayload(input, runId);

  const hasChildren =
    (input.steps && input.steps.length > 0) ||
    (input.toolCalls && input.toolCalls.length > 0);

  if (!hasChildren) {
    debug("sendRun", { runId });
    await send(runPayload);
    return;
  }

  const items: Record<string, unknown>[] = [runPayload];

  if (input.steps) {
    for (const step of input.steps) {
      items.push(buildStepPayload(step, step.runId ?? runId));
    }
  }

  if (input.toolCalls) {
    for (const tc of input.toolCalls) {
      items.push(buildToolCallPayload(tc, tc.runId ?? runId));
    }
  }

  debug("sendRun (batch)", { runId, items: items.length });
  await send({ type: "batch", items });
}

/**
 * Send a single step independently. Requires `runId`.
 *
 * ```ts
 * await sendStep({
 *   runId: "run_abc",
 *   prompt: "...",
 *   response: "...",
 *   model: "gpt-4o",
 *   startTime: new Date(),
 *   endTime: new Date(),
 * });
 * ```
 */
export async function sendStep(
  input: StepInput & { runId: string }
): Promise<void> {
  debug("sendStep", { runId: input.runId });
  await send(buildStepPayload(input, input.runId));
}

/**
 * Send a single tool call independently. Requires `runId`.
 *
 * ```ts
 * await sendToolCall({
 *   runId: "run_abc",
 *   name: "search",
 *   args: { query: "weather" },
 *   result: { temp: 72 },
 *   startTime: new Date(),
 *   endTime: new Date(),
 * });
 * ```
 */
export async function sendToolCall(
  input: ToolCallInput & { runId: string }
): Promise<void> {
  debug("sendToolCall", { runId: input.runId });
  await send(buildToolCallPayload(input, input.runId));
}

import type { AttributeValue, HrTime } from "@opentelemetry/api";
import type { ReadableSpan } from "@opentelemetry/sdk-trace-base";
import type {
  BatchPayload,
  RunPayload,
  StepPayload,
  TCCMetadata,
  TCCMetadataPrimitive,
  ToolCallPayload,
} from "./types.js";

type AttributeMap = Readonly<Record<string, AttributeValue | undefined>>;

const RUN_SPAN_NAMES = new Set([
  "ai.generateText",
  "ai.streamText",
  "ai.generateObject",
  "ai.streamObject",
]);

const STEP_SPAN_NAMES = new Set([
  "ai.generateText.doGenerate",
  "ai.streamText.doStream",
  "ai.generateObject.doGenerate",
  "ai.streamObject.doStream",
]);

const TOOL_CALL_SPAN_NAMES = new Set(["ai.toolCall"]);

const TELEMETRY_METADATA_PREFIX = "ai.telemetry.metadata.";
const RESERVED_METADATA_KEYS = new Set([
  "tcc.runId",
  "tcc.run_id",
  "tcc.sessionId",
  "tcc.session_id",
  "tcc.conversational",
]);

export type AISDKSpanKind = "run" | "step" | "toolCall" | "unknown";

export function debugLog(enabled: boolean, ...args: readonly unknown[]): void {
  if (!enabled) return;

  console.log(
    "[TCC]",
    ...args.map((arg) =>
      typeof arg === "object" && arg !== null
        ? JSON.stringify(arg, null, 2)
        : String(arg)
    )
  );
}

export function getSpanKind(span: Pick<ReadableSpan, "name">): AISDKSpanKind {
  if (RUN_SPAN_NAMES.has(span.name)) return "run";
  if (STEP_SPAN_NAMES.has(span.name)) return "step";
  if (TOOL_CALL_SPAN_NAMES.has(span.name)) return "toolCall";
  return "unknown";
}

export function buildBatchPayload(
  rootSpan: ReadableSpan,
  spans: readonly ReadableSpan[]
): BatchPayload {
  const metadata = extractTelemetryMetadata(rootSpan.attributes);
  const runId = resolveRunId(metadata) ?? crypto.randomUUID();

  const childSpans = [...spans]
    .filter(
      (span) =>
        span.spanContext().spanId !== rootSpan.spanContext().spanId &&
        getSpanKind(span) !== "unknown"
    )
    .sort(
      (left, right) =>
        hrTimeToMilliseconds(left.startTime) -
        hrTimeToMilliseconds(right.startTime)
    );

  const items: BatchPayload["items"] = [
    buildRunPayload(rootSpan, runId, metadata),
  ];

  for (const span of childSpans) {
    const kind = getSpanKind(span);

    if (kind === "step") {
      items.push(buildStepPayload(span, runId));
      continue;
    }

    if (kind === "toolCall") {
      items.push(buildToolCallPayload(span, runId));
    }
  }

  return {
    type: "batch",
    items,
  };
}

export function hrTimeToDate(hrTime: HrTime): Date {
  const [seconds, nanoseconds] = hrTime;
  const milliseconds = seconds * 1000 + nanoseconds / 1_000_000;
  return new Date(milliseconds);
}

function hrTimeToIsoString(hrTime: HrTime): string {
  return hrTimeToDate(hrTime).toISOString();
}

function hrTimeToMilliseconds(hrTime: HrTime): number {
  const [seconds, nanoseconds] = hrTime;
  return seconds * 1000 + nanoseconds / 1_000_000;
}

function buildRunPayload(
  span: ReadableSpan,
  runId: string,
  metadata: TCCMetadata
): RunPayload {
  const payload: RunPayload = {
    type: "run",
    run_id: runId,
    start_time: hrTimeToIsoString(span.startTime),
    end_time: hrTimeToIsoString(span.endTime),
    prompt: extractRunPrompt(span.attributes),
    response: extractResponse(span.attributes),
    status_code: toTCCStatusCode(span),
  };

  const sessionId = resolveSessionId(metadata);
  const conversational = resolveConversational(metadata);
  const customMetadata = stripReservedMetadata(metadata);
  const statusMessage = normalizeStatusMessage(span.status.message);

  if (sessionId !== undefined) payload.session_id = sessionId;
  if (conversational !== undefined) payload.conversational = conversational;
  if (customMetadata !== undefined) payload.metadata = customMetadata;
  if (statusMessage !== undefined) payload.status_message = statusMessage;

  payload.attributes = buildAttributes(span);

  return payload;
}

function buildStepPayload(span: ReadableSpan, runId: string): StepPayload {
  const inputTokens = getNumberAttribute(
    span.attributes,
    "gen_ai.usage.input_tokens",
    "ai.usage.promptTokens",
    "ai.usage.inputTokens"
  );
  const cachedPromptTokens = getNumberAttribute(
    span.attributes,
    "gen_ai.usage.cached_input_tokens",
    "ai.usage.cachedInputTokens",
    "ai.usage.cachedPromptTokens"
  );

  const payload: StepPayload = {
    type: "step",
    run_id: runId,
    step_id: span.spanContext().spanId,
    start_time: hrTimeToIsoString(span.startTime),
    end_time: hrTimeToIsoString(span.endTime),
    prompt: extractStepPrompt(span.attributes),
    response: extractResponse(span.attributes),
    status_code: toTCCStatusCode(span),
  };

  const statusMessage = normalizeStatusMessage(span.status.message);
  const modelRequested = getStringAttribute(
    span.attributes,
    "gen_ai.request.model",
    "ai.model.id"
  );
  const modelUsed = getStringAttribute(
    span.attributes,
    "ai.response.model",
    "gen_ai.response.model",
    "ai.model.id"
  );
  const finishReason = extractFinishReason(span.attributes);
  const completionTokens = getNumberAttribute(
    span.attributes,
    "gen_ai.usage.output_tokens",
    "ai.usage.completionTokens",
    "ai.usage.outputTokens"
  );
  const toolDefinitions = stringifyAttribute(
    getAttribute(span.attributes, "ai.prompt.tools")
  );

  if (statusMessage !== undefined) payload.status_message = statusMessage;
  if (modelRequested !== undefined) payload.model_requested = modelRequested;
  if (modelUsed !== undefined) payload.model_used = modelUsed;
  if (finishReason !== undefined) payload.finish_reason = finishReason;
  if (inputTokens !== undefined) {
    payload.prompt_uncached_tokens =
      cachedPromptTokens !== undefined
        ? Math.max(inputTokens - cachedPromptTokens, 0)
        : inputTokens;
  }
  if (cachedPromptTokens !== undefined) {
    payload.prompt_cached_tokens = cachedPromptTokens;
  }
  if (completionTokens !== undefined) {
    payload.completion_tokens = completionTokens;
  }
  if (toolDefinitions !== undefined) {
    payload.tool_definitions = toolDefinitions;
  }

  payload.attributes = buildAttributes(span);

  return payload;
}

function buildToolCallPayload(
  span: ReadableSpan,
  runId: string
): ToolCallPayload {
  const payload: ToolCallPayload = {
    type: "tool_call",
    run_id: runId,
    tool_call_id:
      getStringAttribute(span.attributes, "ai.toolCall.id") ??
      span.spanContext().spanId,
    tool_name:
      getStringAttribute(span.attributes, "ai.toolCall.name") ?? "unknown",
    start_time: hrTimeToIsoString(span.startTime),
    end_time: hrTimeToIsoString(span.endTime),
    status_code: toTCCStatusCode(span),
  };

  const statusMessage = normalizeStatusMessage(span.status.message);
  const args = stringifyAttribute(
    getAttribute(span.attributes, "ai.toolCall.args")
  );
  const result = stringifyAttribute(
    getAttribute(span.attributes, "ai.toolCall.result")
  );

  if (statusMessage !== undefined) payload.status_message = statusMessage;
  if (args !== undefined) payload.args = args;
  if (result !== undefined) payload.result = result;

  payload.attributes = buildAttributes(span);

  return payload;
}

function buildAttributes(span: ReadableSpan): Record<string, unknown> {
  const attributes: Record<string, unknown> = {
    ...span.attributes,
    "tcc.integration": "@contextcompany/otel/runtime",
    "tcc.trace_id": span.spanContext().traceId,
    "tcc.span_id": span.spanContext().spanId,
    "tcc.span_name": span.name,
  };

  if (span.parentSpanContext?.spanId !== undefined) {
    attributes["tcc.parent_span_id"] = span.parentSpanContext.spanId;
  }

  return attributes;
}

function extractRunPrompt(
  attributes: AttributeMap
): { user_prompt: string; system_prompt?: string } {
  const rawPrompt = stringifyAttribute(
    getAttribute(attributes, "ai.prompt", "ai.prompt.messages")
  );

  if (rawPrompt === undefined) {
    return { user_prompt: "" };
  }

  const parsed = safeJsonParse(rawPrompt);
  const prompt = extractPromptParts(parsed);

  if (prompt !== undefined) {
    return {
      user_prompt: prompt.userPrompt || rawPrompt,
      ...(prompt.systemPrompt !== undefined
        ? { system_prompt: prompt.systemPrompt }
        : {}),
    };
  }

  return { user_prompt: rawPrompt };
}

function extractStepPrompt(
  attributes: AttributeMap
): string {
  return (
    stringifyAttribute(
      getAttribute(attributes, "ai.prompt.messages", "ai.prompt")
    ) ?? ""
  );
}

function extractResponse(
  attributes: AttributeMap
): string {
  return (
    stringifyAttribute(
      getAttribute(
        attributes,
        "ai.response.text",
        "ai.response.object",
        "ai.response.toolCalls"
      )
    ) ?? ""
  );
}

function extractFinishReason(
  attributes: AttributeMap
): string | undefined {
  const directReason = getStringAttribute(
    attributes,
    "ai.response.finishReason",
    "gen_ai.response.finish_reason"
  );

  if (directReason !== undefined) {
    return directReason;
  }

  const finishReasons = getAttribute(
    attributes,
    "gen_ai.response.finish_reasons"
  );
  if (Array.isArray(finishReasons) && finishReasons.length > 0) {
    const firstReason = finishReasons[0];
    if (typeof firstReason === "string") return firstReason;
  }

  return undefined;
}

function extractPromptParts(
  value: unknown
): { userPrompt: string; systemPrompt?: string } | undefined {
  if (!isRecord(value)) return undefined;

  const directPrompt = typeof value.prompt === "string" ? value.prompt : undefined;
  const systemPrompt = toTextContent(value.system ?? value.systemPrompt);

  if (directPrompt !== undefined) {
    return {
      userPrompt: directPrompt,
      ...(systemPrompt ? { systemPrompt } : {}),
    };
  }

  const messageSource = Array.isArray(value.messages)
    ? value.messages
    : Array.isArray(value.prompt)
      ? value.prompt
      : undefined;

  if (messageSource === undefined) return undefined;

  let latestUserPrompt = "";
  let firstSystemPrompt: string | undefined;

  for (const message of messageSource) {
    if (!isRecord(message)) continue;

    const role = typeof message.role === "string" ? message.role : undefined;
    const content = toTextContent(message.content);

    if (role === "system" && firstSystemPrompt === undefined && content) {
      firstSystemPrompt = content;
    }

    if (role === "user" && content) {
      latestUserPrompt = content;
    }
  }

  if (!latestUserPrompt && firstSystemPrompt === undefined) {
    return undefined;
  }

  return {
    userPrompt: latestUserPrompt,
    ...(firstSystemPrompt ? { systemPrompt: firstSystemPrompt } : {}),
  };
}

function toTextContent(value: unknown): string {
  if (typeof value === "string") return value;

  if (Array.isArray(value)) {
    return value
      .map((item) => toTextContent(item))
      .filter((item) => item.length > 0)
      .join("\n");
  }

  if (!isRecord(value)) return "";

  if (typeof value.text === "string") return value.text;
  if ("content" in value) return toTextContent(value.content);

  return "";
}

function extractTelemetryMetadata(
  attributes: AttributeMap
): TCCMetadata {
  const metadata: TCCMetadata = {};

  for (const [key, value] of Object.entries(attributes)) {
    if (!key.startsWith(TELEMETRY_METADATA_PREFIX)) continue;

    const metadataKey = key.slice(TELEMETRY_METADATA_PREFIX.length);
    const normalized = normalizeMetadataValue(value);
    if (normalized !== undefined) {
      metadata[metadataKey] = normalized;
    }
  }

  return metadata;
}

function normalizeMetadataValue(
  value: AttributeValue | undefined
): TCCMetadata[string] | undefined {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === "string" ||
        typeof item === "number" ||
        typeof item === "boolean"
    )
  ) {
    return value as readonly TCCMetadataPrimitive[];
  }

  return undefined;
}

function resolveRunId(metadata: TCCMetadata): string | undefined {
  const value = metadata["tcc.runId"] ?? metadata["tcc.run_id"];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function resolveSessionId(metadata: TCCMetadata): string | undefined {
  const value = metadata["tcc.sessionId"] ?? metadata["tcc.session_id"];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function resolveConversational(metadata: TCCMetadata): boolean | undefined {
  const value = metadata["tcc.conversational"];

  if (typeof value === "boolean") return value;

  if (typeof value === "string") {
    if (value === "true" || value === "1") return true;
    if (value === "false" || value === "0") return false;
  }

  return undefined;
}

function stripReservedMetadata(
  metadata: TCCMetadata
): Record<string, unknown> | undefined {
  const entries = Object.entries(metadata).filter(
    ([key]) => !RESERVED_METADATA_KEYS.has(key)
  );

  if (entries.length === 0) return undefined;

  return Object.fromEntries(entries);
}

function toTCCStatusCode(span: ReadableSpan): number {
  return span.status.code === 2 ? 2 : 0;
}

function normalizeStatusMessage(message: string | undefined): string | undefined {
  return message !== undefined && message.length > 0 ? message : undefined;
}

function getAttribute(
  attributes: AttributeMap,
  ...keys: readonly string[]
): AttributeValue | undefined {
  for (const key of keys) {
    const value = attributes[key];
    if (value !== undefined) return value;
  }

  return undefined;
}

function getStringAttribute(
  attributes: AttributeMap,
  ...keys: readonly string[]
): string | undefined {
  const value = getAttribute(attributes, ...keys);

  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return undefined;
}

function getNumberAttribute(
  attributes: AttributeMap,
  ...keys: readonly string[]
): number | undefined {
  const value = getAttribute(attributes, ...keys);

  if (typeof value === "number") return value;

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function stringifyAttribute(value: AttributeValue | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function safeJsonParse(value: string): unknown | undefined {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

import {
  classifySpan,
  extractToolName,
  extractModelName,
} from "./classifier";
import { debug } from "./logger";
import type {
  OpenClawSpan,
  BatchPayload,
  RunPayload,
  StepPayload,
  ToolCallPayload,
} from "./types";

const DEFAULT_FLUSH_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// ---------------------------------------------------------------------------
// Trace buffer — accumulates spans by traceId
// ---------------------------------------------------------------------------

export type TraceAssemblerConfig = {
  flushTimeoutMs?: number;
  onBatch: (batch: BatchPayload) => void;
};

/**
 * Buffers incoming spans grouped by traceId and assembles them into TCC
 * batch payloads when a root span completes (or when a timeout fires).
 */
export class TraceAssembler {
  private traces = new Map<string, OpenClawSpan[]>();
  private timeouts = new Map<string, NodeJS.Timeout>();
  private rootSeen = new Set<string>();

  private readonly flushTimeoutMs: number;
  private readonly onBatch: (batch: BatchPayload) => void;

  constructor(config: TraceAssemblerConfig) {
    this.flushTimeoutMs = config.flushTimeoutMs ?? DEFAULT_FLUSH_TIMEOUT_MS;
    this.onBatch = config.onBatch;
  }

  /** Ingest a batch of parsed spans. */
  ingest(spans: OpenClawSpan[]): void {
    for (const span of spans) {
      const traceId = span.traceId;

      if (!this.traces.has(traceId)) {
        this.traces.set(traceId, []);
        this.startTimeout(traceId);
      }

      this.traces.get(traceId)!.push(span);

      const classification = classifySpan(span);

      if (classification === "run") {
        this.rootSeen.add(traceId);
        debug(`Root span received for trace ${traceId}`);
      }
    }

    // Check if any traces with a root span are ready to flush.
    // We flush when the root span has been seen — at that point all child
    // spans should already be present (OTLP typically sends them together).
    for (const traceId of this.rootSeen) {
      if (this.traces.has(traceId)) {
        this.flushTrace(traceId);
      }
    }
  }

  /** Flush all buffered traces (e.g. on shutdown). */
  flushAll(): void {
    for (const traceId of [...this.traces.keys()]) {
      this.flushTrace(traceId);
    }
  }

  /** Flush a specific trace by ID. */
  private flushTrace(traceId: string): void {
    const spans = this.traces.get(traceId);
    if (!spans || spans.length === 0) return;

    this.clearTimeout(traceId);
    this.traces.delete(traceId);
    this.rootSeen.delete(traceId);

    debug(`Flushing trace ${traceId} with ${spans.length} span(s)`);

    const batch = assembleTrace(traceId, spans);
    if (batch.items.length > 0) {
      this.onBatch(batch);
    }
  }

  private startTimeout(traceId: string): void {
    const timeout = setTimeout(() => {
      debug(`Trace ${traceId} timed out — flushing incomplete`);
      this.flushTrace(traceId);
    }, this.flushTimeoutMs);

    // Don't prevent Node from exiting
    if (typeof timeout === "object" && "unref" in timeout) {
      (timeout as NodeJS.Timeout).unref();
    }

    this.timeouts.set(traceId, timeout);
  }

  private clearTimeout(traceId: string): void {
    const timeout = this.timeouts.get(traceId);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(traceId);
    }
  }
}

// ---------------------------------------------------------------------------
// Trace assembly — maps OpenClaw spans → TCC batch payload
// ---------------------------------------------------------------------------

function assembleTrace(
  traceId: string,
  spans: OpenClawSpan[]
): BatchPayload {
  const items: (RunPayload | StepPayload | ToolCallPayload)[] = [];

  // Classify all spans
  let rootSpan: OpenClawSpan | undefined;
  const stepSpans: OpenClawSpan[] = [];
  const toolSpans: OpenClawSpan[] = [];

  for (const span of spans) {
    const classification = classifySpan(span);
    switch (classification) {
      case "run":
        rootSpan = span;
        break;
      case "step":
        stepSpans.push(span);
        break;
      case "tool_call":
        toolSpans.push(span);
        break;
      case "agent_turn":
        // Agent turns are intermediate — their attributes are useful context
        // but we don't emit a separate payload for them.
        break;
      case "unknown":
        debug(`Skipping unknown span: ${span.name} (${span.spanId})`);
        break;
    }
  }

  // Generate a stable run ID from the trace ID
  const runId = rootSpan
    ? `ocl_${traceId.slice(0, 16)}`
    : `ocl_${traceId.slice(0, 16)}`;

  // Build run payload
  const runPayload = mapToRunPayload(rootSpan, spans, runId);
  items.push(runPayload);

  // Build step payloads
  for (const stepSpan of stepSpans) {
    items.push(mapToStepPayload(stepSpan, runId));
  }

  // Build tool call payloads
  for (const toolSpan of toolSpans) {
    items.push(mapToToolCallPayload(toolSpan, runId));
  }

  debug(`Assembled batch: 1 run, ${stepSpans.length} step(s), ${toolSpans.length} tool call(s)`);

  return { type: "batch", items };
}

// ---------------------------------------------------------------------------
// Individual payload mappers
// ---------------------------------------------------------------------------

function msToIso(ms: number): string {
  return new Date(ms).toISOString();
}

function getStringAttr(
  span: OpenClawSpan,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const val = span.attributes[key];
    if (typeof val === "string" && val.length > 0) return val;
  }
  return undefined;
}

function getNumberAttr(
  span: OpenClawSpan,
  ...keys: string[]
): number | undefined {
  for (const key of keys) {
    const val = span.attributes[key];
    if (typeof val === "number") return val;
    if (typeof val === "string") {
      const parsed = Number(val);
      if (!isNaN(parsed)) return parsed;
    }
  }
  return undefined;
}

function mapToRunPayload(
  rootSpan: OpenClawSpan | undefined,
  allSpans: OpenClawSpan[],
  runId: string
): RunPayload {
  // If there's no root span, synthesize from the earliest/latest spans
  const startTimeMs = rootSpan?.startTimeMs ?? Math.min(...allSpans.map((s) => s.startTimeMs));
  const endTimeMs = rootSpan?.endTimeMs ?? Math.max(...allSpans.map((s) => s.endTimeMs));
  const hasError = rootSpan ? rootSpan.statusCode === 2 : false;

  // Try to extract user prompt from the root span or any span events
  const userPrompt = extractUserPrompt(rootSpan, allSpans);

  // Try to extract final response from the last LLM step
  const response = extractFinalResponse(allSpans);

  // Extract session ID from any span that has it
  const sessionId = extractSessionId(rootSpan, allSpans);

  // Build attributes from root span's OpenClaw-specific attributes
  const attributes: Record<string, unknown> = {
    "openclaw.framework": "openclaw",
    "openclaw.trace_id": rootSpan?.traceId ?? allSpans[0]?.traceId,
  };

  if (rootSpan) {
    const provider = getStringAttr(rootSpan, "openclaw.provider", "gen_ai.provider.name");
    if (provider) attributes["openclaw.provider"] = provider;

    const serviceName = rootSpan.resourceAttributes?.["service.name"];
    if (serviceName) attributes["openclaw.service_name"] = serviceName;
  }

  const payload: RunPayload = {
    type: "run",
    run_id: runId,
    start_time: msToIso(startTimeMs),
    end_time: msToIso(endTimeMs),
    prompt: { user_prompt: userPrompt },
    status_code: hasError ? 2 : 0,
    attributes,
  };

  if (response) payload.response = response;
  if (sessionId) payload.session_id = sessionId;
  if (rootSpan?.statusMessage) payload.status_message = rootSpan.statusMessage;

  return payload;
}

function mapToStepPayload(span: OpenClawSpan, runId: string): StepPayload {
  const model = extractModelName(span);
  const durationMs = span.endTimeMs - span.startTimeMs;

  // Token counts
  const inputTokens = getNumberAttr(
    span,
    "openclaw.tokens.input",
    "gen_ai.usage.input_tokens"
  );
  const outputTokens = getNumberAttr(
    span,
    "openclaw.tokens.output",
    "gen_ai.usage.output_tokens"
  );
  const cachedTokens = getNumberAttr(
    span,
    "openclaw.tokens.cache_read"
  );

  // Content (if captureContent is enabled)
  const prompt = getStringAttr(span, "gen_ai.prompt") ?? "";
  const response = getStringAttr(span, "gen_ai.completion") ?? "";

  // Provider and other metadata
  const provider = getStringAttr(span, "openclaw.provider", "gen_ai.provider.name");

  const attrs: Record<string, unknown> = {
    "openclaw.span_name": span.name,
    "openclaw.duration_ms": durationMs,
  };
  if (provider) attrs["openclaw.provider"] = provider;

  const uncachedTokens =
    inputTokens !== undefined && cachedTokens !== undefined
      ? inputTokens - cachedTokens
      : inputTokens;

  const payload: StepPayload = {
    type: "step",
    run_id: runId,
    step_id: span.spanId,
    start_time: msToIso(span.startTimeMs),
    end_time: msToIso(span.endTimeMs),
    prompt,
    response,
    status_code: span.statusCode === 2 ? 2 : 0,
    attributes: attrs,
  };

  if (model) {
    payload.model_requested = model;
    payload.model_used = model;
  }
  if (span.statusMessage) payload.status_message = span.statusMessage;
  if (uncachedTokens !== undefined)
    payload.prompt_uncached_tokens = uncachedTokens;
  if (cachedTokens !== undefined) payload.prompt_cached_tokens = cachedTokens;
  if (outputTokens !== undefined) payload.completion_tokens = outputTokens;

  return payload;
}

function mapToToolCallPayload(
  span: OpenClawSpan,
  runId: string
): ToolCallPayload {
  const toolName = extractToolName(span);
  const durationMs = span.endTimeMs - span.startTimeMs;

  const attrs: Record<string, unknown> = {
    "openclaw.span_name": span.name,
    "openclaw.duration_ms": durationMs,
  };

  const payload: ToolCallPayload = {
    type: "tool_call",
    run_id: runId,
    tool_call_id: span.spanId,
    tool_name: toolName,
    start_time: msToIso(span.startTimeMs),
    end_time: msToIso(span.endTimeMs),
    status_code: span.statusCode === 2 ? 2 : 0,
    attributes: attrs,
  };

  if (span.statusMessage) payload.status_message = span.statusMessage;

  return payload;
}

// ---------------------------------------------------------------------------
// Content extraction helpers
// ---------------------------------------------------------------------------

function extractUserPrompt(
  rootSpan: OpenClawSpan | undefined,
  allSpans: OpenClawSpan[]
): string {
  // First, check root span for prompt content
  if (rootSpan) {
    const prompt = getStringAttr(rootSpan, "gen_ai.prompt", "openclaw.prompt");
    if (prompt) return prompt;
  }

  // Fall back to the first LLM step's prompt
  for (const span of allSpans) {
    if (classifySpan(span) === "step") {
      const prompt = getStringAttr(span, "gen_ai.prompt");
      if (prompt) return prompt;
    }
  }

  return "";
}

function extractFinalResponse(allSpans: OpenClawSpan[]): string | undefined {
  // Get the last LLM step's completion
  const stepSpans = allSpans.filter((s) => classifySpan(s) === "step");
  if (stepSpans.length === 0) return undefined;

  // Sort by end time, pick the last one
  stepSpans.sort((a, b) => a.endTimeMs - b.endTimeMs);
  const lastStep = stepSpans[stepSpans.length - 1];

  return getStringAttr(lastStep, "gen_ai.completion") ?? undefined;
}

function extractSessionId(
  rootSpan: OpenClawSpan | undefined,
  allSpans: OpenClawSpan[]
): string | undefined {
  // Check root span first
  if (rootSpan) {
    const sessionId = getStringAttr(
      rootSpan,
      "openclaw.sessionId",
      "openclaw.sessionKey",
      "gen_ai.conversation.id"
    );
    if (sessionId) return sessionId;
  }

  // Check any span for session info
  for (const span of allSpans) {
    const sessionId = getStringAttr(
      span,
      "openclaw.sessionId",
      "openclaw.sessionKey",
      "gen_ai.conversation.id"
    );
    if (sessionId) return sessionId;
  }

  return undefined;
}

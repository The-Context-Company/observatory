// ---------------------------------------------------------------------------
// Collector configuration
// ---------------------------------------------------------------------------

/**
 * Configuration for the OpenClaw OTLP collector.
 *
 * @example
 * ```ts
 * const collector = createCollector({
 *   port: 4318,
 *   apiKey: "tcc_abc123",
 *   debug: true,
 * });
 * ```
 */
export type OpenClawCollectorConfig = {
  /** Port to listen on for incoming OTLP traces. @defaultValue `4318` */
  port?: number;

  /** Host / interface to bind to. @defaultValue `"0.0.0.0"` */
  host?: string;

  /**
   * TCC API key. Can also be set via the `TCC_API_KEY` environment variable.
   * Keys starting with `"dev_"` automatically route to the development
   * ingestion endpoint.
   */
  apiKey?: string;

  /**
   * Custom TCC endpoint URL. Overrides the `TCC_URL` environment variable
   * and dev/prod auto-detection.
   */
  endpoint?: string;

  /** Enable debug logging to the console. @defaultValue `false` */
  debug?: boolean;

  /**
   * Timeout in milliseconds for flushing incomplete traces. If a trace's
   * root span has not arrived within this window, the buffered spans are
   * flushed with whatever data is available.
   *
   * @defaultValue `300_000` (5 minutes)
   */
  flushTimeoutMs?: number;
};

// ---------------------------------------------------------------------------
// Parsed OTLP span (internal)
// ---------------------------------------------------------------------------

/** A single attribute value from the OTLP JSON wire format. */
export type OtlpAttributeValue = {
  stringValue?: string;
  intValue?: string | number;
  doubleValue?: number;
  boolValue?: boolean;
  arrayValue?: { values: OtlpAttributeValue[] };
  kvlistValue?: { values: OtlpKeyValue[] };
};

/** A key–value pair from the OTLP JSON wire format. */
export type OtlpKeyValue = {
  key: string;
  value: OtlpAttributeValue;
};

/** An OTLP span status object. */
export type OtlpStatus = {
  code?: number;
  message?: string;
};

/** A span event from the OTLP JSON wire format. */
export type OtlpSpanEvent = {
  timeUnixNano?: string;
  name: string;
  attributes?: OtlpKeyValue[];
};

/** A single span as received in the OTLP JSON `resourceSpans` payload. */
export type OtlpJsonSpan = {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind?: number;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes?: OtlpKeyValue[];
  status?: OtlpStatus;
  events?: OtlpSpanEvent[];
};

/** Scope-level grouping in the OTLP JSON format. */
export type OtlpScopeSpans = {
  scope?: { name?: string; version?: string };
  spans: OtlpJsonSpan[];
};

/** Resource-level grouping in the OTLP JSON format. */
export type OtlpResourceSpans = {
  resource?: { attributes?: OtlpKeyValue[] };
  scopeSpans: OtlpScopeSpans[];
};

/** Top-level OTLP JSON traces payload. */
export type OtlpTracesPayload = {
  resourceSpans: OtlpResourceSpans[];
};

// ---------------------------------------------------------------------------
// Parsed (flattened) span — our internal representation
// ---------------------------------------------------------------------------

/**
 * A parsed span with flattened attributes, ready for classification and
 * mapping.
 */
export type OpenClawSpan = {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind?: number;
  startTimeMs: number;
  endTimeMs: number;
  attributes: Record<string, string | number | boolean>;
  statusCode: number;
  statusMessage?: string;
  events?: OtlpSpanEvent[];
  /** Resource-level attributes (e.g. service.name). */
  resourceAttributes?: Record<string, string | number | boolean>;
};

// ---------------------------------------------------------------------------
// Span classification
// ---------------------------------------------------------------------------

export type SpanClassification =
  | "run"
  | "step"
  | "tool_call"
  | "agent_turn"
  | "unknown";

// ---------------------------------------------------------------------------
// TCC wire-format payloads (matching @contextcompany/custom)
// ---------------------------------------------------------------------------

export type RunPayload = {
  type: "run";
  run_id: string;
  start_time: string;
  end_time: string;
  prompt: { user_prompt: string; system_prompt?: string };
  response?: string;
  status_code: number;
  status_message?: string;
  session_id?: string;
  metadata?: Record<string, unknown>;
  attributes?: Record<string, unknown>;
};

export type StepPayload = {
  type: "step";
  run_id: string;
  step_id: string;
  start_time: string;
  end_time: string;
  prompt: string;
  response: string;
  status_code: number;
  status_message?: string;
  model_requested?: string;
  model_used?: string;
  finish_reason?: string;
  prompt_uncached_tokens?: number;
  prompt_cached_tokens?: number;
  completion_tokens?: number;
  ttft_ms?: number;
  attributes?: Record<string, unknown>;
};

export type ToolCallPayload = {
  type: "tool_call";
  run_id: string;
  tool_call_id: string;
  tool_name: string;
  start_time: string;
  end_time: string;
  status_code: number;
  status_message?: string;
  args?: string;
  result?: string;
  attributes?: Record<string, unknown>;
};

export type BatchPayload = {
  type: "batch";
  items: (RunPayload | StepPayload | ToolCallPayload)[];
};

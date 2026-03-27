/** A single raw hook event captured from OpenClaw's plugin API. */
export type RawEvent = {
  hook: string;
  timestamp: string;
  event: Record<string, unknown>;
  context: Record<string, unknown>;
};

/** In-flight session accumulating events before send. */
export type ActiveSession = {
  events: RawEvent[];
  startedAt: number;
};

/** Configuration for the TCC OpenClaw plugin. */
export type OpenClawPluginConfig = {
  /** TCC API key. Falls back to TCC_API_KEY env var. */
  apiKey?: string;
  /** TCC ingestion endpoint. Falls back to TCC_URL env var, then auto-detected from key prefix. */
  endpoint?: string;
  /** Enable debug logging. Falls back to TCC_DEBUG env var. */
  debug?: boolean;
};

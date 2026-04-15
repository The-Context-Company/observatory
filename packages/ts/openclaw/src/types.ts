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
  runId: string;
};

/** Configuration for the TCC OpenClaw plugin. */
export type OpenClawPluginConfig = {
  /** TCC API key. Falls back to TCC_API_KEY env var. */
  apiKey?: string;
  /** TCC ingestion endpoint. Falls back to TCC_URL env var, then auto-detected from key prefix. */
  endpoint?: string;
  /** Enable debug logging. Falls back to TCC_DEBUG env var. */
  debug?: boolean;
  /** Explicit run ID. If not set, a random UUID is generated per agent run. */
  runId?: string;
  /** Session ID to group multiple runs in the same conversation. */
  sessionId?: string;
  /** Arbitrary key-value metadata attached to every run. */
  metadata?: Record<string, string>;
};

/** Handle returned by `register()` for run ID and metadata access. */
export type OpenClawHandle = {
  /** Returns the run ID of the most recently completed (or in-progress) run. */
  getRunId: () => string | null;
  /** Sets the run ID that will be used for the next run. */
  setRunId: (id: string) => void;
  /** Merges additional metadata for subsequent runs. */
  setMetadata: (meta: Record<string, string>) => void;
};

export type TCCPiConfig = {
  /** TCC API key. Falls back to `TCC_API_KEY` env var. */
  apiKey?: string;

  /** Custom TCC endpoint URL. */
  endpoint?: string;

  /** Fixed run ID for all runs in this session. Auto-generated if omitted. */
  runId?: string;

  /** Session ID for grouping related runs. */
  sessionId?: string;

  /** Whether this session is part of a conversational flow. */
  conversational?: boolean;

  /** Custom metadata to attach to every run. */
  metadata?: Record<string, unknown>;

  /** Enable debug logging. */
  debug?: boolean;
};

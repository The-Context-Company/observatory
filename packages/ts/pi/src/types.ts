/**
 * Configuration for Pi Agent SDK instrumentation.
 *
 * @example
 * ```ts
 * instrumentPiSession(session, {
 *   sessionId: "conversation-123",
 *   conversational: true,
 *   debug: true,
 * });
 * ```
 */
export type TCCPiConfig = {
  /**
   * TCC API key. Can also be set via the `TCC_API_KEY` environment variable.
   * Keys starting with `"dev_"` automatically route to the development endpoint.
   */
  apiKey?: string;

  /**
   * Custom TCC endpoint URL. Overrides the `TCC_URL` environment variable
   * and dev/prod auto-detection.
   */
  endpoint?: string;

  /**
   * Custom run identifier. When provided, all agent runs in this session
   * use this run ID. When omitted, a unique ID is generated per run.
   */
  runId?: string;

  /**
   * Session ID for grouping related runs in a conversation.
   */
  sessionId?: string;

  /**
   * Whether this session is part of a conversational flow.
   */
  conversational?: boolean;

  /**
   * Custom metadata to attach to every run.
   */
  metadata?: Record<string, unknown>;

  /**
   * Enable debug logging to the console.
   */
  debug?: boolean;
};

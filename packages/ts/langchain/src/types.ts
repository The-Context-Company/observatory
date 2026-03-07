export type TCCCallbackHandlerConfig = {
  /**
   * TCC API key. Can also be set via TCC_API_KEY environment variable.
   */
  apiKey?: string;

  /**
   * TCC endpoint URL. Defaults based on API key prefix (dev_ → dev endpoint).
   */
  endpoint?: string;

  /**
   * Unique identifier for this run. Auto-generated if not provided.
   */
  runId?: string;

  /**
   * Session ID for grouping related runs in a conversation.
   */
  sessionId?: string;

  /**
   * Whether this run is part of a conversational flow.
   */
  conversational?: boolean;

  /**
   * Custom metadata to attach to the run.
   */
  metadata?: Record<string, unknown>;

  /**
   * Enable debug logging.
   */
  debug?: boolean;
};

/**
 * Per-invocation TCC overrides passed via LangChain's `metadata` in RunnableConfig.
 *
 * TCC-specific config goes under the `tcc` key. Everything else in the metadata
 * object is automatically tracked as custom metadata on the run.
 *
 * @example
 * ```ts
 * setGlobalHandler(new TCCCallbackHandler());
 *
 * await graph.invoke(
 *   { messages },
 *   {
 *     metadata: {
 *       tcc: { sessionId: "session-123", conversational: true },
 *       user_id: "user-42",
 *       environment: "production",
 *     },
 *   }
 * );
 * ```
 */
export type TCCInvokeMetadata = {
  /** TCC-specific overrides for this invocation. */
  tcc?: {
    /** Override the run ID for this invocation. */
    runId?: string;
    /** Override the session ID for this invocation. */
    sessionId?: string;
    /** Override whether this invocation is conversational. */
    conversational?: boolean;
  };
  /** All other keys are tracked as custom metadata on the run. */
  [key: string]: unknown;
};

export type RunPayload = {
  type: "run";
  run_id: string;
  start_time: string;
  end_time: string;
  prompt: { user_prompt: string; system_prompt?: string };
  response: string;
  status_code: number;
  status_message?: string;
  session_id?: string;
  conversational?: boolean;
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
  completion_tokens?: number;
  prompt_cached_tokens?: number;
  ttft_ms?: number;
  tool_definitions?: string;
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

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

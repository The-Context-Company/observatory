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
  prompt_cached_tokens?: number;
  completion_tokens?: number;
  real_total_cost?: number;
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

// ---------------------------------------------------------------------------
// Internal run tracking state
// ---------------------------------------------------------------------------

/** Tracks a single tool execution from start to end. */
export type ToolCallRecord = {
  toolCallId: string;
  toolName: string;
  args: unknown;
  startTimeMs: number;
  endTimeMs?: number;
  result?: unknown;
  isError: boolean;
};

/** Tracks a single LLM step (assistant message). */
export type StepRecord = {
  stepId: string;
  model: string;
  provider: string;
  prompt: string;
  response: string;
  startTimeMs: number;
  endTimeMs: number;
  stopReason: string;
  errorMessage?: string;
  usage: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    totalTokens: number;
    cost: number;
  };
};

/** Tracks a full agent run from agent_start to agent_end. */
export type RunRecord = {
  runId: string;
  startTimeMs: number;
  endTimeMs?: number;
  userPrompt: string;
  response: string;
  hasError: boolean;
  errorMessage?: string;
  steps: StepRecord[];
  toolCalls: ToolCallRecord[];
  /** Last user message text seen before any assistant messages. */
  pendingUserPrompt?: string;
};

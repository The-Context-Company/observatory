/** A single raw hook event captured from OpenClaw's plugin API. */
export type RawEvent = {
  hook: string;
  timestamp: string;
  event: Record<string, unknown>;
  context: Record<string, unknown>;
};

/** Subset of OpenClaw's PluginHookAgentContext exposed to user callbacks. */
export type OpenClawRunContext = {
  agentId?: string;
  sessionKey?: string;
  sessionId?: string;
  channelId?: string;
  workspaceDir?: string;
  trigger?: string;
};

/** In-flight session accumulating events before send. */
export type ActiveSession = {
  events: RawEvent[];
  startedAt: number;
  runId: string;
  sessionId?: string;
  metadata: Record<string, string>;
  turnCacheRunId?: string;
  onRunStartCalled?: boolean;
};

/** Mutation API passed into onRunStart. Changes apply to this run only. */
export type OpenClawRunMutators = {
  /** Override the auto-minted run ID for this run. Must be a valid UUID to be usable with feedback/metadata endpoints. */
  setRunId: (id: string) => void;
  /** Override the session ID for this run. */
  setSessionId: (id: string) => void;
  /** Merge metadata into this run's payload (shallow merge). */
  setMetadata: (meta: Record<string, string>) => void;
};

/** Called at before_prompt_build with the run context and mutation API. */
export type OpenClawRunStartHandler = (info: {
  runId: string;
  ctx: OpenClawRunContext;
  prompt: string;
} & OpenClawRunMutators) => void | Promise<void>;

/** Called at agent_end with the finalized run info. */
export type OpenClawRunEndHandler = (info: {
  runId: string;
  ctx: OpenClawRunContext;
  success: boolean;
  sessionId?: string;
  metadata: Record<string, string>;
}) => void | Promise<void>;

/** Default providers resolved once per session. */
export type OpenClawDefaultSessionId =
  | string
  | ((ctx: OpenClawRunContext) => string | undefined);
export type OpenClawDefaultMetadata =
  | Record<string, string>
  | ((ctx: OpenClawRunContext) => Record<string, string>);

/** Configuration for the TCC OpenClaw plugin. */
export type OpenClawPluginConfig = {
  /** TCC API key. Falls back to TCC_API_KEY env var. */
  apiKey?: string;
  /** TCC ingestion endpoint. Falls back to TCC_BASE_URL env var, then auto-detected from key prefix. */
  endpoint?: string;
  /** Enable debug logging. Falls back to TCC_DEBUG env var. */
  debug?: boolean;

  /**
   * Explicit run ID for the FIRST run only (legacy). For per-run IDs use
   * `onRunStart`'s `setRunId`, or call `handle.setRunContext(sessionKey, {...})`.
   */
  runId?: string;
  /** Default session ID applied to every run (falls back to ctx.sessionKey). */
  sessionId?: OpenClawDefaultSessionId;
  /** Default metadata merged into every run. */
  metadata?: OpenClawDefaultMetadata;

  /** Called at before_prompt_build; lets you override runId/sessionId/metadata per run. */
  onRunStart?: OpenClawRunStartHandler;
  /** Called at agent_end; lets you attach feedback / log the runId. */
  onRunEnd?: OpenClawRunEndHandler;
};

/** Handle returned by `register()` for run ID and metadata access. */
export type OpenClawHandle = {
  /** Returns the run ID of the most recently completed (or in-progress) run. For concurrency-safe lookups, use `getRunIdForSession`. */
  getRunId: () => string | null;
  /** Per-session run ID lookup (concurrency-safe). */
  getRunIdForSession: (sessionKey: string) => string | null;
  /** Legacy: set the runId for the NEXT new session (consumed once). */
  setRunId: (id: string) => void;
  /** Legacy: merge metadata into the global default for subsequent runs. */
  setMetadata: (meta: Record<string, string>) => void;
  /** Per-session override: apply runId/sessionId/metadata to an in-flight or future session. */
  setRunContext: (
    sessionKey: string,
    ctx: { runId?: string; sessionId?: string; metadata?: Record<string, string> },
  ) => void;
};

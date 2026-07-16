/**
 * @contextcompany/openclaw: OpenClaw plugin for The Context Company
 *
 * Thin forwarder: collects raw hook events during an agent run,
 * then sends them all as one batch on agent_end.
 *
 * Per-session state is keyed by ctx.sessionKey, so it is safe under concurrent
 * runs (e.g. multiple Slack threads served by the same gateway).
 *
 * All parsing/transformation happens server-side.
 */

import { getTCCApiKey, getTCCUrl } from "@contextcompany/api";
import type {
  ActiveSession,
  OpenClawHandle,
  OpenClawPluginConfig,
  OpenClawRunContext,
  OpenClawRunStartHandler,
  OpenClawRunEndHandler,
  OpenClawDefaultSessionId,
  OpenClawDefaultMetadata,
} from "./types.js";
export type {
  OpenClawPluginConfig,
  OpenClawHandle,
  OpenClawRunContext,
  OpenClawRunStartHandler,
  OpenClawRunEndHandler,
} from "./types.js";
import { safeClone, sendToTcc } from "./transport.js";

// Module-level so multiple registrations in the same process converge on
// one runId per turn, instead of each minting its own.
const turnRunIdCache = new Map<string, { runId: string; createdAt: number }>();
const TURN_RUN_ID_MAX_AGE_MS = 30 * 60 * 1000;

function acquireTurnRunId(sessionKey: string): string {
  const now = Date.now();
  const existing = turnRunIdCache.get(sessionKey);
  if (existing && now - existing.createdAt < TURN_RUN_ID_MAX_AGE_MS) {
    return existing.runId;
  }
  const runId = crypto.randomUUID();
  turnRunIdCache.set(sessionKey, { runId, createdAt: now });
  return runId;
}

function releaseTurnRunId(sessionKey: string, runId: string): void {
  const existing = turnRunIdCache.get(sessionKey);
  if (existing && existing.runId === runId) {
    turnRunIdCache.delete(sessionKey);
  }
}

function resolveDefaultSessionId(
  def: OpenClawDefaultSessionId | undefined,
  ctx: OpenClawRunContext,
): string | undefined {
  if (typeof def === "function") {
    try {
      return def(ctx);
    } catch {
      return undefined;
    }
  }
  return def;
}

function resolveDefaultMetadata(
  def: OpenClawDefaultMetadata | undefined,
  ctx: OpenClawRunContext,
): Record<string, string> {
  if (typeof def === "function") {
    try {
      return { ...(def(ctx) ?? {}) };
    } catch {
      return {};
    }
  }
  return { ...(def ?? {}) };
}

function toRunContext(ctx: unknown): OpenClawRunContext {
  const c = (ctx ?? {}) as Record<string, unknown>;
  return {
    agentId: typeof c.agentId === "string" ? c.agentId : undefined,
    sessionKey: typeof c.sessionKey === "string" ? c.sessionKey : undefined,
    sessionId: typeof c.sessionId === "string" ? c.sessionId : undefined,
    channelId: typeof c.channelId === "string" ? c.channelId : undefined,
    workspaceDir: typeof c.workspaceDir === "string" ? c.workspaceDir : undefined,
    trigger: typeof c.trigger === "string" ? c.trigger : undefined,
  };
}

function registerHooks(
  api: any,
  configOverrides?: OpenClawPluginConfig,
): OpenClawHandle {
  const activeSessions = new Map<string, ActiveSession>();
  // Per-session pending overrides applied at the next before_prompt_build.
  const pendingOverrides = new Map<
    string,
    { runId?: string; sessionId?: string; metadata?: Record<string, string> }
  >();

  const merged: Record<string, unknown> = {
    ...(api.pluginConfig ?? {}),
    ...configOverrides,
  };
  const pluginConfig = merged as OpenClawPluginConfig & Record<string, unknown>;

  const debug =
    pluginConfig.debug === true || process.env.TCC_DEBUG === "true";

  const log = {
    info: (msg: string) => console.log(`[tcc] ${msg}`),
    warn: (msg: string) => console.warn(`[tcc] ${msg}`),
  };

  const apiKey =
    (typeof pluginConfig.apiKey === "string" ? pluginConfig.apiKey : null) ??
    getTCCApiKey();

  if (!apiKey) {
    log.warn("No TCC_API_KEY found. Set env var or plugin config. Disabled.");
    return {
      getRunId: () => null,
      getRunIdForSession: () => null,
      setRunId: () => {},
      setMetadata: () => {},
      setRunContext: () => {},
    };
  }

  const url =
    (typeof pluginConfig.endpoint === "string"
      ? pluginConfig.endpoint
      : null) ??
    getTCCUrl("/v1/openclaw", apiKey);

  log.info(`exporting runs to ${url}`);

  // -------------------------------------------------------------------
  // Global/default state
  // -------------------------------------------------------------------
  let lastRunId: string | null = null;
  // Legacy one-shot: consumed by the next session that starts.
  let legacyNextRunId: string | null =
    typeof pluginConfig.runId === "string" ? pluginConfig.runId : null;
  // Mutable defaults appended to every run (merged with callback-level overrides).
  const globalDefaultMetadata: Record<string, string> = {};

  const onRunStart = pluginConfig.onRunStart;
  const onRunEnd = pluginConfig.onRunEnd;

  // -------------------------------------------------------------------
  // Stale session cleanup: flush sessions that never got an agent_end
  // -------------------------------------------------------------------
  const STALE_SESSION_MS = 30 * 60 * 1000; // 30 minutes

  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, session] of activeSessions) {
      if (now - session.startedAt > STALE_SESSION_MS) {
        if (debug) log.info(`flushing stale session: ${key}`);

        sendToTcc(
          buildPayload(session, /* stale */ true),
          apiKey,
          url,
          debug,
          log,
        ).catch((err) => {
          log.warn(`failed to send stale session: ${err}`);
        });

        activeSessions.delete(key);
        if (session.turnCacheRunId) {
          releaseTurnRunId(key, session.turnCacheRunId);
        }
      }
    }
  }, 5 * 60 * 1000);

  if (cleanupInterval.unref) cleanupInterval.unref();

  function buildPayload(
    session: ActiveSession,
    stale: boolean,
  ): Record<string, unknown> {
    // tcc.* keys are the canonical contract. User-supplied metadata goes
    // through first; the plugin's authoritative runId/sessionId stamp last
    // so there's a single source of truth.
    const metadata: Record<string, unknown> = {
      ...globalDefaultMetadata,
      ...session.metadata,
      "tcc.runId": session.runId,
      ...(session.sessionId ? { "tcc.sessionId": session.sessionId } : {}),
    };
    return {
      framework: "openclaw",
      events: session.events,
      metadata,
      ...(stale ? { stale: true } : {}),
    };
  }

  // -------------------------------------------------------------------
  // Session lifecycle
  // -------------------------------------------------------------------

  function ensureSession(
    sessionKey: string,
    ctx: OpenClawRunContext,
  ): ActiveSession {
    let session = activeSessions.get(sessionKey);
    if (session) return session;

    // Legacy top-level runId wins once; otherwise share via turnRunIdCache.
    let runId: string;
    let turnCacheRunId: string | undefined;
    if (legacyNextRunId) {
      runId = legacyNextRunId;
      legacyNextRunId = null;
    } else {
      runId = acquireTurnRunId(sessionKey);
      turnCacheRunId = runId;
    }

    // sessionId resolution order:
    //   1. user config `sessionId` (static or function)
    //   2. ctx.sessionKey, OpenClaw's internal session key, which is
    //      thread-scoped for channel integrations with threads enabled
    //      (verified via live data: Slack threads in the same channel get
    //      distinct sessionKeys).
    const defaultSessionId = resolveDefaultSessionId(pluginConfig.sessionId, ctx);
    const defaultMetadata = resolveDefaultMetadata(pluginConfig.metadata, ctx);

    session = {
      events: [],
      startedAt: Date.now(),
      runId,
      sessionId: defaultSessionId ?? ctx.sessionKey,
      metadata: defaultMetadata,
      turnCacheRunId,
    };
    activeSessions.set(sessionKey, session);

    // Apply any pending setRunContext overrides queued before the session
    // started.
    const pending = pendingOverrides.get(sessionKey);
    if (pending) {
      if (pending.runId) session.runId = pending.runId;
      if (pending.sessionId) session.sessionId = pending.sessionId;
      if (pending.metadata) Object.assign(session.metadata, pending.metadata);
      pendingOverrides.delete(sessionKey);
    }

    lastRunId = session.runId;
    if (debug) log.info(`run started (runId: ${session.runId})`);
    return session;
  }

  function pushEvent(hook: string, event: unknown, ctx: unknown): void {
    const runCtx = toRunContext(ctx);
    const sessionKey = runCtx.sessionKey;
    if (!sessionKey) return;
    const session = ensureSession(sessionKey, runCtx);

    session.events.push({
      hook,
      timestamp: new Date().toISOString(),
      event: safeClone(event) as Record<string, unknown>,
      context: safeClone(ctx) as Record<string, unknown>,
    });
  }

  // -------------------------------------------------------------------
  // Hooks
  // -------------------------------------------------------------------

  api.on("before_prompt_build", async (event: any, ctx: any) => {
    const runCtx = toRunContext(ctx);
    const sessionKey = runCtx.sessionKey;
    if (!sessionKey) return;

    const session = ensureSession(sessionKey, runCtx);

    if (onRunStart && !session.onRunStartCalled) {
      session.onRunStartCalled = true;
      const mutators = {
        setRunId: (id: string) => {
          session.runId = id;
          lastRunId = id;
        },
        setSessionId: (id: string) => {
          session.sessionId = id;
        },
        setMetadata: (meta: Record<string, unknown>) => {
          for (const [k, v] of Object.entries(meta)) {
            // Route tcc.* shortcuts into canonical session slots so they
            // win at send time, regardless of which API the user picked.
            if (k === "tcc.runId" && typeof v === "string") {
              session.runId = v;
              lastRunId = v;
            } else if (k === "tcc.sessionId" && typeof v === "string") {
              session.sessionId = v;
            } else {
              session.metadata[k] = v as string;
            }
          }
        },
      };
      try {
        await onRunStart({
          runId: session.runId,
          ctx: runCtx,
          prompt: typeof event?.prompt === "string" ? event.prompt : "",
          ...mutators,
        });
      } catch (err) {
        log.warn(`onRunStart threw: ${err}`);
      }
    }
  });

  api.on("llm_input", (event: any, ctx: any) => {
    pushEvent("llm_input", event, ctx);
    if (debug) log.info(`llm_input (model: ${event.model})`);
  });

  api.on("llm_output", (event: any, ctx: any) => {
    pushEvent("llm_output", event, ctx);
    if (debug) log.info(`llm_output (model: ${event.model})`);
  });

  api.on("before_tool_call", (event: any, ctx: any) => {
    pushEvent("before_tool_call", event, ctx);
    if (debug) log.info(`before_tool_call (tool: ${event.toolName})`);
  });

  api.on("after_tool_call", (event: any, ctx: any) => {
    pushEvent("after_tool_call", event, ctx);
    if (debug) log.info(`after_tool_call (tool: ${event.toolName})`);
  });

  api.on("agent_end", (event: any, ctx: any) => {
    const runCtx = toRunContext(ctx);
    const sessionKey = runCtx.sessionKey;
    if (!sessionKey) return;

    pushEvent("agent_end", event, ctx);

    // Defer send to a microtask so llm_output (on the same synchronous tick)
    // is collected first.
    queueMicrotask(async () => {
      const session = activeSessions.get(sessionKey);
      if (!session) return;

      // Detach the session from the map BEFORE any await. If a rapid
      // follow-up turn arrives for the same sessionKey while we're
      // awaiting onRunEnd, ensureSession must create a fresh session
      // rather than appending to this already-flushed one.
      activeSessions.delete(sessionKey);
      if (session.turnCacheRunId) {
        releaseTurnRunId(sessionKey, session.turnCacheRunId);
      }

      if (debug)
        log.info(
          `agent_end: sending ${session.events.length} events (runId: ${session.runId})`,
        );

      const payload = buildPayload(session, false);

      sendToTcc(payload, apiKey, url, debug, log).catch((err) => {
        log.warn(`failed to send events: ${err}`);
      });

      if (onRunEnd) {
        try {
          await onRunEnd({
            runId: session.runId,
            ctx: runCtx,
            success: event?.success !== false,
            sessionId: session.sessionId,
            metadata: { ...globalDefaultMetadata, ...session.metadata },
          });
        } catch (err) {
          log.warn(`onRunEnd threw: ${err}`);
        }
      }
    });
  });

  return {
    getRunId: () => lastRunId,
    getRunIdForSession: (sessionKey: string) =>
      activeSessions.get(sessionKey)?.runId ?? null,
    setRunId: (id: string) => {
      legacyNextRunId = id;
    },
    setMetadata: (meta: Record<string, string>) => {
      Object.assign(globalDefaultMetadata, meta);
    },
    setRunContext: (
      sessionKey: string,
      ctx: {
        runId?: string;
        sessionId?: string;
        metadata?: Record<string, string>;
      },
    ) => {
      const existing = activeSessions.get(sessionKey);
      if (existing) {
        if (ctx.runId) {
          existing.runId = ctx.runId;
          lastRunId = ctx.runId;
        }
        if (ctx.sessionId) existing.sessionId = ctx.sessionId;
        if (ctx.metadata) Object.assign(existing.metadata, ctx.metadata);
        return;
      }
      const pending = pendingOverrides.get(sessionKey) ?? {};
      if (ctx.runId) pending.runId = ctx.runId;
      if (ctx.sessionId) pending.sessionId = ctx.sessionId;
      if (ctx.metadata)
        pending.metadata = { ...(pending.metadata ?? {}), ...ctx.metadata };
      pendingOverrides.set(sessionKey, pending);
    },
  };
}

/**
 * Full OpenClaw plugin object. Install via `openclaw plugins install`.
 * and configure in `openclaw.json` under `plugins.entries`.
 */
const plugin = {
  id: "openclaw",
  name: "The Context Company",
  description:
    "AI agent observability that finds patterns in production and helps teams improve their agents",
  register(api: any) {
    registerHooks(api);
  },
};

export default plugin;

/**
 * Named export for manual registration (e.g. from a custom extension).
 *
 * @example
 * ```ts
 * import { register } from "@contextcompany/openclaw";
 * export default async function (api) {
 *   const handle = register(api, {
 *     onRunStart: ({ runId, ctx, setMetadata }) => {
 *       setMetadata({ channel: ctx.channelId ?? "unknown" });
 *     },
 *     onRunEnd: ({ runId }) => {
 *       // stash runId for feedback submission
 *     },
 *   });
 * }
 * ```
 */
export function register(
  api: any,
  configOverrides?: OpenClawPluginConfig,
): OpenClawHandle {
  return registerHooks(api, configOverrides);
}

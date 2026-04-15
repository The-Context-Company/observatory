/**
 * @contextcompany/openclaw — OpenClaw plugin for The Context Company
 *
 * Thin forwarder: collects raw hook events during an agent run,
 * then sends them all as one batch on agent_end.
 *
 * All parsing/transformation happens server-side.
 */

import { getTCCApiKey, getTCCUrl } from "@contextcompany/api";
import type { ActiveSession, OpenClawHandle, OpenClawPluginConfig } from "./types.js";
export type { OpenClawPluginConfig, OpenClawHandle } from "./types.js";
import { safeClone, sendToTcc } from "./transport.js";

function registerHooks(
  api: any,
  configOverrides?: OpenClawPluginConfig,
): OpenClawHandle {
  const activeSessions = new Map<string, ActiveSession>();

  const pluginConfig: Record<string, unknown> = {
    ...(api.pluginConfig ?? {}),
    ...configOverrides,
  };
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
      setRunId: () => {},
      setMetadata: () => {},
    };
  }

  const url =
    (typeof pluginConfig.endpoint === "string"
      ? pluginConfig.endpoint
      : null) ??
    getTCCUrl("/v1/openclaw", apiKey);

  log.info(`exporting runs to ${url}`);

  // -------------------------------------------------------------------
  // Run ID + metadata state
  // -------------------------------------------------------------------
  let lastRunId: string | null = null;
  let nextRunId: string | null =
    typeof pluginConfig.runId === "string" ? pluginConfig.runId : null;
  const sessionId =
    typeof pluginConfig.sessionId === "string" ? pluginConfig.sessionId : undefined;
  let extraMetadata: Record<string, string> = {
    ...((pluginConfig.metadata as Record<string, string>) ?? {}),
  };

  // -------------------------------------------------------------------
  // Stale session cleanup — flush sessions that never got an agent_end
  // -------------------------------------------------------------------
  const STALE_SESSION_MS = 30 * 60 * 1000; // 30 minutes

  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, session] of activeSessions) {
      if (now - session.startedAt > STALE_SESSION_MS) {
        if (debug) log.info(`flushing stale session: ${key}`);

        sendToTcc(
          {
            framework: "openclaw",
            runId: session.runId,
            events: session.events,
            stale: true,
            ...(sessionId ? { sessionId } : {}),
            ...(Object.keys(extraMetadata).length > 0
              ? { metadata: { ...extraMetadata } }
              : {}),
          },
          apiKey,
          url,
          debug,
          log,
        ).catch((err) => {
          log.warn(`failed to send stale session: ${err}`);
        });

        activeSessions.delete(key);
      }
    }
  }, 5 * 60 * 1000); // check every 5 minutes

  if (cleanupInterval.unref) cleanupInterval.unref();

  // -------------------------------------------------------------------
  // Helper: push a raw event into the session's event list
  // -------------------------------------------------------------------
  function pushEvent(hook: string, event: unknown, ctx: unknown): void {
    const sessionKey = (ctx as any)?.sessionKey;
    if (!sessionKey) return;

    let session = activeSessions.get(sessionKey);
    if (!session) {
      const runId = nextRunId ?? crypto.randomUUID();
      nextRunId = null;
      lastRunId = runId;
      session = { events: [], startedAt: Date.now(), runId };
      activeSessions.set(sessionKey, session);
      if (debug) log.info(`run started (runId: ${runId})`);
    }

    session.events.push({
      hook,
      timestamp: new Date().toISOString(),
      event: safeClone(event) as Record<string, unknown>,
      context: safeClone(ctx) as Record<string, unknown>,
    });
  }

  // -------------------------------------------------------------------
  // Hooks: collect raw events
  // -------------------------------------------------------------------

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
    const sessionKey = ctx?.sessionKey;
    if (!sessionKey) return;

    pushEvent("agent_end", event, ctx);

    // Defer sending to a microtask so llm_output (which fires on the
    // same synchronous tick as agent_end) gets collected first.
    queueMicrotask(() => {
      const session = activeSessions.get(sessionKey);
      if (!session) return;

      if (debug)
        log.info(`agent_end — sending ${session.events.length} events (runId: ${session.runId})`);

      const payload: Record<string, unknown> = {
        framework: "openclaw",
        runId: session.runId,
        events: session.events,
        ...(sessionId ? { sessionId } : {}),
        ...(Object.keys(extraMetadata).length > 0
          ? { metadata: { ...extraMetadata } }
          : {}),
      };

      sendToTcc(payload, apiKey, url, debug, log).catch((err) => {
        log.warn(`failed to send events: ${err}`);
      });

      activeSessions.delete(sessionKey);
    });
  });

  return {
    getRunId: () => lastRunId,
    setRunId: (id: string) => {
      nextRunId = id;
    },
    setMetadata: (meta: Record<string, string>) => {
      Object.assign(extraMetadata, meta);
    },
  };
}

/**
 * Full OpenClaw plugin object — install via `openclaw plugins install`
 * and configure in `openclaw.json` under `plugins.entries`.
 *
 * @example
 * ```json
 * {
 *   "plugins": {
 *     "allow": ["@contextcompany/openclaw"],
 *     "entries": {
 *       "@contextcompany/openclaw": {
 *         "enabled": true,
 *         "config": {
 *           "apiKey": "${TCC_API_KEY}"
 *         }
 *       }
 *     }
 *   }
 * }
 * ```
 */
const plugin = {
  id: "@contextcompany/openclaw",
  name: "The Context Company",
  description: "Agent observability — captures LLM calls, tool executions, and agent lifecycle events",
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
 *   register(api, { apiKey: "tcc_...", debug: true });
 * }
 * ```
 */
export function register(
  api: any,
  configOverrides?: OpenClawPluginConfig,
): OpenClawHandle {
  return registerHooks(api, configOverrides);
}

/**
 * @contextcompany/openclaw — OpenClaw plugin for The Context Company
 *
 * Thin forwarder: collects raw hook events during an agent run,
 * then sends them all as one batch on agent_end.
 *
 * All parsing/transformation happens server-side.
 */

import type { ActiveSession, OpenClawPluginConfig } from "./types.js";
export type { OpenClawPluginConfig } from "./types.js";
import { safeClone, sendToTcc } from "./transport.js";

/**
 * Register the TCC observability plugin with an OpenClaw plugin API.
 *
 * @example
 * ```ts
 * // As an OpenClaw extension (index.ts):
 * import { register } from "@contextcompany/openclaw";
 * export default async function (api) { register(api); }
 *
 * // Or with explicit config:
 * import { register } from "@contextcompany/openclaw";
 * export default async function (api) {
 *   register(api, { apiKey: "tcc_...", debug: true });
 * }
 * ```
 */
export function register(
  api: any,
  configOverrides?: OpenClawPluginConfig,
): void {
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
    process.env.TCC_API_KEY;

  if (!apiKey) {
    log.warn("No TCC_API_KEY found. Set env var or plugin config. Disabled.");
    return;
  }

  const url =
    (typeof pluginConfig.endpoint === "string"
      ? pluginConfig.endpoint
      : null) ??
    process.env.TCC_URL ??
    (apiKey.startsWith("dev_")
      ? "https://dev.thecontext.company/v1/openclaw"
      : "https://api.thecontext.company/v1/openclaw");

  log.info(`exporting runs to ${url}`);

  // -------------------------------------------------------------------
  // Helper: push a raw event into the session's event list
  // -------------------------------------------------------------------
  function pushEvent(hook: string, event: unknown, ctx: unknown): void {
    const sessionKey = (ctx as any)?.sessionKey;
    if (!sessionKey) return;

    let session = activeSessions.get(sessionKey);
    if (!session) {
      session = { events: [], startedAt: Date.now() };
      activeSessions.set(sessionKey, session);
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
        log.info(`agent_end — sending ${session.events.length} events`);

      const payload = {
        framework: "openclaw",
        events: session.events,
      };

      sendToTcc(payload, apiKey, url, debug, log).catch((err) => {
        log.warn(`failed to send events: ${err}`);
      });

      activeSessions.delete(sessionKey);
    });
  });
}

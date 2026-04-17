/**
 * OpenClaw extension: TCC observability with per-run IDs and metadata.
 *
 * Drop this file into your OpenClaw extensions directory — the gateway
 * will load it automatically on startup.
 *
 * What it demonstrates:
 *   - Auto-minted UUID per agent turn (safe for concurrent Slack threads).
 *   - Per-run metadata via `onRunStart` (e.g. user id, channel, prompt preview).
 *   - Feedback hookup via `onRunEnd` (log or stash the runId for a 👍/👎 button).
 *   - Custom runId override when the caller wants deterministic IDs.
 */

import { register, type OpenClawHandle } from "@contextcompany/openclaw";

let handle: OpenClawHandle;

export default async function (api: any) {
  handle = register(api, {
    // API key — falls back to TCC_API_KEY env var if not set here.
    // apiKey: "tcc_...",

    // Default session id applied to every run. `ctx.sessionKey` is stable
    // per OpenClaw session — in Slack with thread-bound sessions, this
    // maps 1:1 to a thread.
    sessionId: (ctx) => ctx.sessionKey ?? "default",

    // Default metadata merged into every run. Per-run overrides win.
    metadata: (ctx) => ({
      channel: ctx.channelId ?? "unknown",
      agent: ctx.agentId ?? "unknown",
    }),

    // Called at before_agent_start for every new turn. `runId` is the
    // auto-minted UUID for this run; override or enrich it here.
    onRunStart: ({ runId, ctx, prompt, setRunId, setMetadata }) => {
      // Example: override with a caller-supplied UUID if available.
      // setRunId(myUuid);

      // Example: attach per-run metadata.
      setMetadata({
        promptPreview: prompt.slice(0, 120),
        trigger: ctx.trigger ?? "user",
      });

      console.log(`[tcc] run start — runId: ${runId} session: ${ctx.sessionKey}`);
    },

    // Called at agent_end after the payload is flushed. Use this to wire
    // up feedback — stash the runId somewhere the user's 👍/👎 button
    // can read, or post an ephemeral message to the thread.
    onRunEnd: ({ runId, ctx, success }) => {
      console.log(
        `[tcc] run end — runId: ${runId} success: ${success} session: ${ctx.sessionKey}`,
      );
      // Example:
      //   import { submitFeedback } from "@contextcompany/otel";
      //   lastRunIdByThread.set(ctx.sessionKey, runId);
      //   // later, when user clicks 👍:
      //   await submitFeedback({ runId, score: "thumbs_up" });
    },

    debug: true,
  });
}

/**
 * Expose the handle for other extensions.
 *
 *   import { getHandle } from "../tcc-observability/index.ts";
 *   const runId = getHandle().getRunIdForSession(sessionKey);
 */
export function getHandle(): OpenClawHandle {
  return handle;
}

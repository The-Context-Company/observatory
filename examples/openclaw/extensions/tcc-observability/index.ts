/**
 * OpenClaw extension: TCC observability with per-run metadata + feedback wiring.
 *
 * You do NOT need this extension for the common case — just install the
 * plugin (`openclaw plugins install @contextcompany/openclaw`). The plugin
 * already auto-generates a unique runId per turn and auto-scopes sessionId
 * to the conversation thread for channel-based setups.
 *
 * Use this extension only when you need:
 *   - Per-run metadata (e.g. the Slack user who sent the message).
 *   - A deterministic runId supplied by your caller.
 *   - Feedback wiring: capture runId per thread so a 👍/👎 reaction or
 *     slash command can later call submitFeedback({ runId }).
 */

import { register, submitFeedback, type OpenClawHandle } from "@contextcompany/openclaw";

let handle: OpenClawHandle;

// Stashed by onRunEnd. Lets a reaction or slash-command handler look up
// the most recent runId for a given conversation.
const runIdByConversation = new Map<string, string>();

export default async function (api: any) {
  handle = register(api, {
    // API key — falls back to TCC_API_KEY env var if not set here.
    // apiKey: "tcc_...",

    onRunStart: ({ runId, ctx, prompt, setRunId, setMetadata }) => {
      // runId is the auto-minted UUID. Override with your own if needed:
      // setRunId(myCallerUuid);

      // Attach per-run metadata. Anything you put here is filterable in
      // the TCC dashboard.
      setMetadata({
        agent: ctx.agentId ?? "unknown",
        trigger: ctx.trigger ?? "user",
        promptPreview: prompt.slice(0, 120),
      });
    },

    onRunEnd: ({ runId, ctx }) => {
      // Stash the runId by conversation so a reaction handler can retrieve
      // it. sessionKey is a stable per-conversation key in OpenClaw.
      if (ctx.sessionKey) runIdByConversation.set(ctx.sessionKey, runId);
    },

    debug: true,
  });
}

/**
 * Look up the runId for the most recent run in a conversation. Use from
 * your own reaction/slash-command handler when a user gives feedback:
 *
 *   const runId = getRunIdForConversation(sessionKey);
 *   if (runId) await submitFeedback({ runId, score: "thumbs_up" });
 */
export function getRunIdForConversation(sessionKey: string): string | undefined {
  return runIdByConversation.get(sessionKey);
}

/** Expose the handle so other extensions can reach it. */
export function getHandle(): OpenClawHandle {
  return handle;
}

// Re-export for convenience.
export { submitFeedback };

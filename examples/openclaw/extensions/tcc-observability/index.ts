/**
 * OpenClaw extension: TCC observability with run ID + metadata support.
 *
 * Place this in your OpenClaw extensions directory and the gateway
 * will load it automatically on startup.
 *
 * The handle returned by register() lets you:
 *   - Get the run ID after a run completes (for feedback submission)
 *   - Set a custom run ID before the next run starts
 *   - Attach metadata to all subsequent runs
 */

import { register, type OpenClawHandle } from "@contextcompany/openclaw";

let handle: OpenClawHandle;

export default async function (api: any) {
  handle = register(api, {
    // API key — falls back to TCC_API_KEY env var if not set here
    // apiKey: "tcc_...",

    // Group runs in the same conversation
    sessionId: "my-session-id",

    // Attach metadata to every run
    metadata: {
      environment: "production",
      userId: "user_abc",
    },

    debug: true,
  });

  // --- Example: hook into agent_end to log the run ID ---

  api.on("agent_end", () => {
    // getRunId() returns the ID of the run that just finished
    const runId = handle.getRunId();
    console.log(`[tcc] run finished — runId: ${runId}`);

    // You can now use this runId to submit feedback:
    //
    //   import { submitFeedback } from "@contextcompany/otel";
    //   await submitFeedback({ runId, score: "thumbs_up" });
  });
}

/**
 * Export the handle so other extensions can access it if needed.
 *
 * Example from another extension:
 *   import { getHandle } from "../tcc-observability/index.ts";
 *   const runId = getHandle().getRunId();
 */
export function getHandle(): OpenClawHandle {
  return handle;
}

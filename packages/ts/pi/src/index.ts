/**
 * @contextcompany/pi — Instrumentation for the Pi Agent SDK.
 *
 * Non-invasive telemetry collection for Pi agent sessions. Subscribes to
 * session events and automatically sends run, step, and tool call data
 * to The Context Company's API.
 *
 * @example
 * ```ts
 * import { createAgentSession } from '@mariozechner/pi-coding-agent';
 * import { instrumentPiSession } from '@contextcompany/pi';
 *
 * const { session } = await createAgentSession();
 * instrumentPiSession(session);
 *
 * await session.prompt('What files are in the current directory?');
 * ```
 *
 * @packageDocumentation
 */

export { instrumentPiSession } from "./instrument";
export type { PiInstrumentation } from "./instrument";
export type { TCCPiConfig } from "./types";
export { submitFeedback } from "@contextcompany/api";

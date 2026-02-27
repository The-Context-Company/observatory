/**
 * @contextcompany/custom — Manual instrumentation SDK for AI agent
 * observability.
 *
 * Two patterns are supported:
 *
 * **Builder pattern** — instrument as you go:
 * ```ts
 * import { run } from "@contextcompany/custom";
 *
 * const r = run();
 * r.prompt("Hello");
 * r.response("Hi!");
 * await r.end();
 * ```
 *
 * **Factory pattern** — send pre-built data:
 * ```ts
 * import { sendRun } from "@contextcompany/custom";
 *
 * await sendRun({ prompt: "Hello", startTime: t0, endTime: t1 });
 * ```
 *
 * @packageDocumentation
 */

export { Run, run } from "./run";
export { Step } from "./step";
export { ToolCall } from "./tool-call";

export { sendRun, sendStep, sendToolCall } from "./send";

export { configure } from "./config";

export type {
  RunOptions,
  StepOptions,
  ToolCallOptions,
  TokenUsage,
  ModelConfig,
  RunInput,
  StepInput,
  ToolCallInput,
  ClientConfig,
} from "./types";

export { submitFeedback } from "@contextcompany/api";

// Builder pattern — instrument as you go
export { Run, run } from "./run";
export { Step } from "./step";
export { ToolCall } from "./tool-call";

// Factory pattern — send pre-built data
export { sendRun, sendStep, sendToolCall } from "./send";

// Configuration
export { configure } from "./config";

// Types
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

// Re-exports
export { submitFeedback } from "@contextcompany/api";

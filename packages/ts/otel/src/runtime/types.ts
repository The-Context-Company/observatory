import type { Tracer } from "@opentelemetry/api";

export type TCCMetadataPrimitive = string | number | boolean;
export type TCCMetadataValue =
  | TCCMetadataPrimitive
  | readonly TCCMetadataPrimitive[];
export type TCCMetadata = Record<string, TCCMetadataValue>;

export type TCCAISDKTelemetryConfig = {
  apiKey: string;
  url?: string;
  debug?: boolean;
  metadata?: TCCMetadata;
  tracerName?: string;
  tracerVersion?: string;
};

export type TCCExperimentalTelemetry = {
  isEnabled?: boolean;
  functionId?: string;
  metadata?: TCCMetadata;
  tracer?: Tracer;
};

export type AISDKFinishHandler = (
  ...args: readonly unknown[]
) => void | Promise<void>;

export type AISDKCallOptions = {
  experimental_telemetry?: TCCExperimentalTelemetry;
  onFinish?: AISDKFinishHandler;
};

export type RunPayload = {
  type: "run";
  run_id: string;
  start_time: string;
  end_time: string;
  prompt: { user_prompt: string; system_prompt?: string };
  response: string;
  status_code: number;
  status_message?: string;
  session_id?: string;
  conversational?: boolean;
  metadata?: Record<string, unknown>;
  attributes?: Record<string, unknown>;
};

export type StepPayload = {
  type: "step";
  run_id: string;
  step_id: string;
  start_time: string;
  end_time: string;
  prompt: string;
  response: string;
  status_code: number;
  status_message?: string;
  model_requested?: string;
  model_used?: string;
  finish_reason?: string;
  prompt_uncached_tokens?: number;
  prompt_cached_tokens?: number;
  completion_tokens?: number;
  tool_definitions?: string;
  attributes?: Record<string, unknown>;
};

export type ToolCallPayload = {
  type: "tool_call";
  run_id: string;
  tool_call_id: string;
  tool_name: string;
  start_time: string;
  end_time: string;
  status_code: number;
  status_message?: string;
  args?: string;
  result?: string;
  attributes?: Record<string, unknown>;
};

export type BatchPayload = {
  type: "batch";
  items: Array<RunPayload | StepPayload | ToolCallPayload>;
};

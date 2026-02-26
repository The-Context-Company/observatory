export type RunOptions = {
  runId?: string;
  sessionId?: string;
  conversational?: boolean;
  startTime?: Date;
  /** Auto-flush timeout in ms. Set to 0 to disable. Default: 20 minutes. */
  timeout?: number;
};

export type StepOptions = {
  stepId?: string;
  startTime?: Date;
};

export type ToolCallOptions = {
  toolCallId?: string;
  name?: string;
  startTime?: Date;
};

export type TokenUsage = {
  uncached?: number;
  cached?: number;
  completion?: number;
};

export type ModelConfig = string | { requested?: string; used?: string };

// Factory inputs — used with sendRun / sendStep / sendToolCall

export type RunInput = {
  runId?: string;
  sessionId?: string;
  conversational?: boolean;
  prompt: string;
  response?: string;
  startTime: Date | string;
  endTime: Date | string;
  statusCode?: number;
  statusMessage?: string;
  metadata?: Record<string, string>;
  steps?: StepInput[];
  toolCalls?: ToolCallInput[];
};

export type StepInput = {
  runId?: string;
  stepId?: string;
  prompt: string;
  response: string;
  startTime: Date | string;
  endTime: Date | string;
  statusCode?: number;
  statusMessage?: string;
  model?: ModelConfig;
  finishReason?: string;
  tokens?: TokenUsage;
  cost?: number;
  toolDefinitions?: string | unknown[];
};

export type ToolCallInput = {
  runId?: string;
  toolCallId?: string;
  name: string;
  startTime: Date | string;
  endTime: Date | string;
  statusCode?: number;
  statusMessage?: string;
  args?: string | Record<string, unknown>;
  result?: string | Record<string, unknown>;
};

export type ClientConfig = {
  apiKey?: string;
  debug?: boolean;
  url?: string;
  runTimeout?: number;
};

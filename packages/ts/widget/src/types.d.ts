// TODO: when we merge this package in @contextcompany/otel, we can remove this file

export type UIRunRow = {
  trace_id: string;
  start_time: Date;
  duration_ns: number;
  status_code: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  response: string;
};

export type UIRun = {
  traceId: string;
  spanId: string;
  startTime: Date;
  durationNs: number;
  statusCode: number;
  statusMessage: string | null;
  promptTokens: number;
  completionTokens: number;
  prompt: string;
  response: string;
  attributes: Record<string, AttributeValue>;
};

export type UIStep = {
  traceId: string;
  spanId: string;
  startTime: Date;
  durationNs: number;
  statusCode: number;
  statusMessage: string | null;
  response: string;
  attributes: Record<string, AttributeValue>;
};

export type UIToolCall = {
  traceId: string;
  spanId: string;
  startTime: Date;
  durationNs: number;
  statusCode: number;
  statusMessage: string | null;
  toolName: string;
  toolArgs: string;
  toolResult: string;
  attributes: Record<string, AttributeValue>;
};

export type EnrichedUIStep = UIStep & {
  toolCalls: UIToolCall[];
};

export type EnrichedUIRun = UIRun & {
  steps: EnrichedUIStep[];
};

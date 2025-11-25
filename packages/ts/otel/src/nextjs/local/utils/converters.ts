import { AttributeValue, HrTime } from "@opentelemetry/api";
import { ReadableSpan } from "@opentelemetry/sdk-trace-base";
import { UIRun, UIStep, UIToolCall } from "../types";

export const isRun = (span: ReadableSpan) =>
  span.name === "ai.generateText" || span.name === "ai.streamText";

export const isStep = (span: ReadableSpan) =>
  span.name === "ai.generateText.doGenerate" ||
  span.name === "ai.streamText.doStream";

export const isToolCall = (span: ReadableSpan) => span.name === "ai.toolCall";

export const hrTimeToDate = (hrTime: HrTime): Date => {
  const [seconds, nanoseconds] = hrTime;
  const milliseconds = seconds * 1000 + nanoseconds / 1_000_000;
  return new Date(milliseconds);
};

export const getUserPromptFromPrompt = (prompt: string): string => {
  try {
    const parsed = JSON.parse(prompt);
    if ("prompt" in parsed) return parsed.prompt;
    if ("messages" in parsed) {
      const messages = parsed.messages;
      const lastMessage = messages.at(-1);
      if ("content" in lastMessage) {
        if (Array.isArray(lastMessage.content)) {
          return lastMessage.content
            .map((message: any) =>
              message.type === "text" ? message.text : ""
            )
            .join("\n");
        }
        if (typeof lastMessage.content === "string") {
          return lastMessage.content;
        }
      }
    }
    return prompt;
  } catch (error) {
    return prompt;
  }
};

export const shapeSpansIntoRuns = (spans: ReadableSpan[]) => {
  const runs: UIRun[] = [];
  const steps: UIStep[] = [];
  const toolCalls: UIToolCall[] = [];

  for (const span of spans) {
    if (isRun(span)) runs.push(convertSpanToRun(span));
    else if (isStep(span)) steps.push(convertSpanToStep(span));
    else if (isToolCall(span)) toolCalls.push(convertSpanToToolCall(span));
  }

  return { runs, steps, toolCalls };
};

export const convertSpanToRun = (span: ReadableSpan): UIRun => {
  const traceId = span.spanContext().traceId;
  const spanId = span.spanContext().spanId;

  const startTimeNs = hrTimeToDate(span.startTime);
  const endTimeNs = hrTimeToDate(span.endTime);
  const durationMs = endTimeNs.getTime() - startTimeNs.getTime();
  const durationNs = durationMs * 1_000_000;

  const statusCode = span.status.code;
  const statusMessage = span.status.message;

  const attributes = span.attributes as unknown as Record<
    string,
    AttributeValue
  >;

  const promptTokens =
    attributes["ai.usage.promptTokens"] ??
    attributes["gen_ai.usage.input_tokens"] ??
    attributes["ai.usage.inputTokens"] ??
    -1;
  const completionTokens =
    attributes["ai.usage.completionTokens"] ??
    attributes["gen_ai.usage.output_tokens"] ??
    attributes["ai.usage.outputTokens"] ??
    -1;

  const fullPrompt = attributes["ai.prompt"] as string;
  const response = attributes["ai.response.text"] as string;

  return {
    traceId: traceId,
    spanId: spanId,
    startTime: startTimeNs,
    durationNs: durationNs,
    statusCode: statusCode,
    statusMessage: statusMessage,
    promptTokens: promptTokens as number,
    completionTokens: completionTokens as number,
    prompt: getUserPromptFromPrompt(fullPrompt ?? ""),
    response: response ?? "",
    attributes: attributes,
  };
};

export const convertSpanToStep = (span: ReadableSpan): UIStep => {
  const traceId = span.spanContext().traceId;
  const spanId = span.spanContext().spanId;

  const startTimeNs = hrTimeToDate(span.startTime);
  const endTimeNs = hrTimeToDate(span.endTime);
  const durationMs = endTimeNs.getTime() - startTimeNs.getTime();
  const durationNs = durationMs * 1_000_000;

  const statusCode = span.status.code;
  const statusMessage = span.status.message;

  const attributes = span.attributes as unknown as Record<
    string,
    AttributeValue
  >;

  const response = attributes["ai.response.text"] as string;

  return {
    traceId: traceId,
    spanId: spanId,
    startTime: startTimeNs,
    durationNs: durationNs,
    statusCode: statusCode,
    statusMessage: statusMessage,
    response: response ?? "",
    attributes: attributes,
  };
};

export const convertSpanToToolCall = (span: ReadableSpan): UIToolCall => {
  const traceId = span.spanContext().traceId;
  const spanId = span.spanContext().spanId;

  const startTimeNs = hrTimeToDate(span.startTime);
  const endTimeNs = hrTimeToDate(span.endTime);
  const durationMs = endTimeNs.getTime() - startTimeNs.getTime();
  const durationNs = durationMs * 1_000_000;

  const statusCode = span.status.code;
  const statusMessage = span.status.message;

  const attributes = span.attributes as unknown as Record<
    string,
    AttributeValue
  >;

  const toolName = attributes["ai.toolCall.name"] as string;
  const toolArgs = attributes["ai.toolCall.args"] as string;
  const toolResult = attributes["ai.toolCall.result"] as string;

  return {
    traceId: traceId,
    spanId: spanId,
    startTime: startTimeNs,
    durationNs: durationNs,
    statusCode: statusCode,
    statusMessage: statusMessage,
    toolName: toolName ?? "",
    toolArgs: toolArgs ?? "",
    toolResult: toolResult ?? "",
    attributes: attributes,
  };
};

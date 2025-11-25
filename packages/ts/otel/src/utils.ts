import { ReadableSpan } from "@opentelemetry/sdk-trace-base";

export const getRunIdFromSpanMetadata = (span: ReadableSpan): string | null => {
  if (!span.attributes) return null;

  const runId =
    span.attributes["ai.telemetry.metadata.tcc.runId"] ||
    span.attributes["ai.telemetry.metadata.tcc.run_id"];

  if (!runId) return null;

  return runId as string;
};

export const isRunSpan = (span: ReadableSpan): boolean => {
  return (
    span.name === "ai.generateText" ||
    span.name === "ai.streamText" ||
    span.name === "ai.generateObject" ||
    span.name === "ai.streamObject"
  );
};

export const isStepSpan = (span: ReadableSpan): boolean => {
  return (
    span.name === "ai.generateText.doGenerate" ||
    span.name === "ai.streamText.doStream" ||
    span.name === "ai.generateObject.doGenerate" ||
    span.name === "ai.streamObject.doStream"
  );
};

export const isToolCallSpan = (span: ReadableSpan): boolean => {
  return span.name === "ai.toolCall";
};

export type SpanType = "run" | "step" | "toolCall" | "unknown";
export const getSpanType = (span: ReadableSpan): SpanType => {
  if (isRunSpan(span)) return "run";
  if (isStepSpan(span)) return "step";
  if (isToolCallSpan(span)) return "toolCall";
  return "unknown";
};

import { ReadableSpan } from "@opentelemetry/sdk-trace-base";

const getGenAIOperationName = (span: ReadableSpan): string | undefined => {
  const operationName = span.attributes?.["gen_ai.operation.name"];
  return typeof operationName === "string" ? operationName : undefined;
};

const getTCCSpanType = (span: ReadableSpan): string | undefined => {
  const spanType = span.attributes?.["tcc.span.type"];
  return typeof spanType === "string" ? spanType : undefined;
};

export const getRunIdFromSpanMetadata = (span: ReadableSpan): string | null => {
  if (!span.attributes) return null;

  const runId =
    span.attributes["ai.telemetry.metadata.tcc.runId"] ||
    span.attributes["ai.telemetry.metadata.tcc.run_id"] ||
    span.attributes["ai.settings.context.tcc.runId"] ||
    span.attributes["ai.settings.context.tcc.run_id"];

  if (!runId) return null;

  return runId as string;
};

export const isRunSpan = (span: ReadableSpan): boolean => {
  const operationName = getGenAIOperationName(span);
  const spanType = getTCCSpanType(span);
  return (
    span.name === "ai.generateText" ||
    span.name === "ai.streamText" ||
    span.name === "ai.generateObject" ||
    span.name === "ai.streamObject" ||
    operationName === "invoke_agent" ||
    ((operationName === "embeddings" || operationName === "rerank") &&
      spanType !== "embedding" &&
      spanType !== "reranking")
  );
};

export const isStepSpan = (span: ReadableSpan): boolean => {
  const operationName = getGenAIOperationName(span);
  const spanType = getTCCSpanType(span);
  return (
    span.name === "ai.generateText.doGenerate" ||
    span.name === "ai.streamText.doStream" ||
    span.name === "ai.generateObject.doGenerate" ||
    span.name === "ai.streamObject.doStream" ||
    operationName === "agent_step" ||
    operationName === "chat" ||
    (operationName === "embeddings" && spanType === "embedding") ||
    (operationName === "rerank" && spanType === "reranking")
  );
};

export const isToolCallSpan = (span: ReadableSpan): boolean => {
  return (
    span.name === "ai.toolCall" ||
    getGenAIOperationName(span) === "execute_tool"
  );
};

export type SpanType = "run" | "step" | "toolCall" | "unknown";
export const getSpanType = (span: ReadableSpan): SpanType => {
  if (isRunSpan(span)) return "run";
  if (isStepSpan(span)) return "step";
  if (isToolCallSpan(span)) return "toolCall";
  return "unknown";
};

export const isAISDKSpan = (span: ReadableSpan): boolean => {
  if (span.name.startsWith("ai.")) return true;

  return (
    ["ai", "gen_ai"].includes(span.instrumentationScope?.name ?? "") &&
    getSpanType(span) !== "unknown"
  );
};

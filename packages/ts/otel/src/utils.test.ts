import type { ReadableSpan } from "@opentelemetry/sdk-trace-base";
import { describe, expect, it } from "vitest";
import { getRunIdFromSpanMetadata, getSpanType, isAISDKSpan } from "./utils";

const span = ({
  name,
  attributes = {},
  instrumentationScope = "ai",
}: {
  name: string;
  attributes?: Record<string, string>;
  instrumentationScope?: string;
}) =>
  ({
    name,
    attributes,
    instrumentationScope: { name: instrumentationScope },
  }) as unknown as ReadableSpan;

describe("AI SDK span compatibility", () => {
  it.each([
    ["AI SDK 5 generate", "ai.generateText", "run"],
    ["AI SDK 5 stream", "ai.streamText", "run"],
    ["AI SDK 6 step", "ai.streamText.doStream", "step"],
    ["AI SDK 6 tool", "ai.toolCall", "toolCall"],
  ] as const)("recognizes %s legacy spans", (_label, name, expectedType) => {
    const legacySpan = span({ name });

    expect(isAISDKSpan(legacySpan)).toBe(true);
    expect(getSpanType(legacySpan)).toBe(expectedType);
  });

  it.each([
    ["invoke_agent", "run"],
    ["agent_step", "step"],
    ["chat", "step"],
    ["execute_tool", "toolCall"],
  ] as const)("recognizes AI SDK 7 %s spans", (operationName, expectedType) => {
    const nativeSpan = span({
      name: `${operationName} mock-model`,
      instrumentationScope: "gen_ai",
      attributes: { "gen_ai.operation.name": operationName },
    });

    expect(isAISDKSpan(nativeSpan)).toBe(true);
    expect(getSpanType(nativeSpan)).toBe(expectedType);
  });

  it.each([
    ["embeddings", "operation", "run"],
    ["embeddings", "embedding", "step"],
    ["rerank", "operation", "run"],
    ["rerank", "reranking", "step"],
  ] as const)(
    "recognizes AI SDK 7 %s %s spans",
    (operationName, spanType, expectedType) => {
      const nativeSpan = span({
        name: `${operationName} mock-model`,
        instrumentationScope: "ai",
        attributes: {
          "gen_ai.operation.name": operationName,
          "tcc.span.type": spanType,
        },
      });

      expect(isAISDKSpan(nativeSpan)).toBe(true);
      expect(getSpanType(nativeSpan)).toBe(expectedType);
    }
  );

  it("does not capture another library's generic GenAI spans", () => {
    const otherSpan = span({
      name: "chat mock-model",
      instrumentationScope: "another-instrumentation",
      attributes: { "gen_ai.operation.name": "chat" },
    });

    expect(isAISDKSpan(otherSpan)).toBe(false);
  });

  it.each([
    ["ai.telemetry.metadata.tcc.runId", "legacy-run-id"],
    ["ai.telemetry.metadata.tcc.run_id", "legacy-snake-run-id"],
    ["ai.settings.context.tcc.runId", "v7-run-id"],
    ["ai.settings.context.tcc.run_id", "v7-snake-run-id"],
  ])("reads a run ID from %s", (attribute, runId) => {
    expect(
      getRunIdFromSpanMetadata(
        span({ name: "ai.streamText", attributes: { [attribute]: runId } })
      )
    ).toBe(runId);
  });
});

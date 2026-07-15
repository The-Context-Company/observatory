import type { Context } from "@opentelemetry/api";
import type {
  ReadableSpan,
  Span,
  SpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { describe, expect, it, vi } from "vitest";
import { AISDKSpanProcessor } from "./TCCSpanProcessor";

const createProcessor = () => {
  const processor: SpanProcessor = {
    onStart: vi.fn(),
    onEnd: vi.fn(),
    shutdown: vi.fn(async () => undefined),
    forceFlush: vi.fn(async () => undefined),
  };

  return processor;
};

const createSpan = ({
  name,
  attributes = {},
  instrumentationScope = "ai",
}: {
  name: string;
  attributes?: Record<string, string>;
  instrumentationScope?: string;
}) => {
  const mutableAttributes = { ...attributes };
  const testSpan = {
    name,
    attributes: mutableAttributes,
    instrumentationScope: { name: instrumentationScope },
    setAttribute(key: string, value: string) {
      mutableAttributes[key] = value;
      return this;
    },
  };

  return testSpan as unknown as Span;
};

describe("AISDKSpanProcessor", () => {
  it("continues forwarding AI SDK 5 and 6 spans", () => {
    const baseProcessor = createProcessor();
    const processor = new AISDKSpanProcessor(baseProcessor);
    const legacySpan = createSpan({ name: "ai.streamText" });

    processor.onStart(legacySpan, {} as Context);
    processor.onEnd(legacySpan as unknown as ReadableSpan);

    expect(baseProcessor.onStart).toHaveBeenCalledWith(legacySpan, {});
    expect(baseProcessor.onEnd).toHaveBeenCalledWith(legacySpan);
  });

  it("forwards native AI SDK 7 spans and preserves TCC metadata", () => {
    const baseProcessor = createProcessor();
    const processor = new AISDKSpanProcessor(baseProcessor);
    const nativeSpan = createSpan({
      name: "invoke_agent mock-model",
      instrumentationScope: "gen_ai",
      attributes: {
        "gen_ai.operation.name": "invoke_agent",
        "ai.settings.context.tcc.runId": "run-7",
        "ai.settings.context.tcc.sessionId": "session-7",
      },
    });

    processor.onStart(nativeSpan, {} as Context);
    processor.onEnd(nativeSpan as unknown as ReadableSpan);

    expect(nativeSpan.attributes).toMatchObject({
      "ai.telemetry.metadata.tcc.runId": "run-7",
      "ai.telemetry.metadata.tcc.sessionId": "session-7",
    });
    expect(baseProcessor.onStart).toHaveBeenCalledOnce();
    expect(baseProcessor.onEnd).toHaveBeenCalledOnce();
  });

  it("ignores unrelated spans", () => {
    const baseProcessor = createProcessor();
    const processor = new AISDKSpanProcessor(baseProcessor);
    const unrelatedSpan = createSpan({
      name: "GET /api/users",
      instrumentationScope: "http",
    });

    processor.onStart(unrelatedSpan, {} as Context);
    processor.onEnd(unrelatedSpan as unknown as ReadableSpan);

    expect(baseProcessor.onStart).not.toHaveBeenCalled();
    expect(baseProcessor.onEnd).not.toHaveBeenCalled();
  });
});

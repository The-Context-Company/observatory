import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { generateText } from "ai";
import { afterEach, describe, expect, it } from "vitest";
import { registerAISDKTelemetry, tccTelemetry } from "./telemetry";

const registrationKey = Symbol.for("@contextcompany/ai-sdk.telemetry");

afterEach(() => {
  delete (globalThis as any)[registrationKey];
  (globalThis as any).AI_SDK_TELEMETRY_INTEGRATIONS = [];
});

describe("AI SDK 7 integration", () => {
  it("emits typed native spans and runtime context through global registration", async () => {
    const exporter = new InMemorySpanExporter();
    const provider = new BasicTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(exporter)],
    });
    registerAISDKTelemetry({ tracer: provider.getTracer("gen_ai") });

    const tracking = tccTelemetry({
      metadata: {
        "tcc.runId": "00000000-0000-4000-8000-000000000001",
        "tcc.sessionId": "session-1",
      },
    });
    await generateText({
      model: {
        specificationVersion: "v4",
        provider: "mock-provider",
        modelId: "mock-model",
        supportedUrls: {},
        doGenerate: async () => ({
          content: [{ type: "text", text: "hello" }],
          finishReason: { unified: "stop", raw: "stop" },
          usage: {
            inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
            outputTokens: { total: 1, text: 1, reasoning: 0 },
          },
          warnings: [],
        }),
        doStream: async () => {
          throw new Error("Streaming is not used in this test");
        },
      },
      prompt: "hello",
      ...tracking,
    });
    await provider.forceFlush();

    const spans = exporter.getFinishedSpans();
    expect(spans.map(({ attributes }) => attributes["tcc.span.type"])).toEqual(
      expect.arrayContaining(["operation", "step", "languageModel"])
    );
    expect(
      spans.find(
        ({ attributes }) => attributes["tcc.span.type"] === "operation"
      )?.attributes["ai.settings.context.tcc.runId"]
    ).toBe("00000000-0000-4000-8000-000000000001");
    expect(
      spans.find(
        ({ attributes }) => attributes["tcc.span.type"] === "operation"
      )?.attributes["ai.settings.context.tcc.sessionId"]
    ).toBe("session-1");

    await provider.shutdown();
  });
});

import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { describe, expect, it } from "vitest";
import { AISDKSpanProcessor } from "./TCCSpanProcessor";

const selectedVersion = process.env.AI_SDK_TEST_VERSION;
const versionIt = (version: string) =>
  !selectedVersion || selectedVersion === version ? it : it.skip;

const v3AndV4Usage = {
  inputTokens: { total: 2, noCache: 2, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};

const createHarness = (instrumentationScope: string) => {
  const exporter = new InMemorySpanExporter();
  const provider = new BasicTracerProvider({
    spanProcessors: [new AISDKSpanProcessor(new SimpleSpanProcessor(exporter))],
  });
  return {
    exporter,
    provider,
    tracer: provider.getTracer(instrumentationScope),
  };
};

describe("real AI SDK telemetry compatibility", () => {
  versionIt("5")("captures AI SDK 5 telemetry", async () => {
    const { generateText } = await import("ai-v5");
    const { exporter, provider, tracer } = createHarness("ai-sdk-v5-test");
    await generateText({
      model: {
        specificationVersion: "v2",
        provider: "mock-provider",
        modelId: "mock-model-id",
        supportedUrls: {},
        doGenerate: async () => ({
          content: [{ type: "text", text: "v5 response" }],
          finishReason: "stop",
          usage: { inputTokens: 2, outputTokens: 1, totalTokens: 3 },
          warnings: [],
        }),
        doStream: async () => {
          throw new Error("Streaming is not used by this test");
        },
      },
      prompt: "v5 prompt",
      experimental_telemetry: {
        isEnabled: true,
        tracer,
        metadata: { "tcc.runId": "v5-run" },
      },
    });
    await provider.forceFlush();
    const spans = exporter.getFinishedSpans();
    expect(spans.map(({ name }) => name)).toEqual(
      expect.arrayContaining(["ai.generateText", "ai.generateText.doGenerate"])
    );
    expect(
      spans.find(({ name }) => name === "ai.generateText")?.attributes[
        "ai.telemetry.metadata.tcc.runId"
      ]
    ).toBe("v5-run");
    await provider.shutdown();
  });

  versionIt("6")("captures AI SDK 6 telemetry", async () => {
    const { generateText } = await import("ai-v6");
    const { exporter, provider, tracer } = createHarness("ai-sdk-v6-test");
    await generateText({
      model: {
        specificationVersion: "v3",
        provider: "mock-provider",
        modelId: "mock-model-id",
        supportedUrls: {},
        doGenerate: async () => ({
          content: [{ type: "text", text: "v6 response" }],
          finishReason: { unified: "stop", raw: "stop" },
          usage: v3AndV4Usage,
          warnings: [],
        }),
        doStream: async () => {
          throw new Error("Streaming is not used by this test");
        },
      },
      prompt: "v6 prompt",
      experimental_telemetry: {
        isEnabled: true,
        tracer,
        metadata: { "tcc.runId": "v6-run" },
      },
    });
    await provider.forceFlush();
    const spans = exporter.getFinishedSpans();
    expect(spans.map(({ name }) => name)).toEqual(
      expect.arrayContaining(["ai.generateText", "ai.generateText.doGenerate"])
    );
    expect(
      spans.find(({ name }) => name === "ai.generateText")?.attributes[
        "ai.telemetry.metadata.tcc.runId"
      ]
    ).toBe("v6-run");
    await provider.shutdown();
  });

  const testV7 = async (packageName: "ai-v7" | "ai-v7-min") => {
    const { OpenTelemetry } = await import("@ai-sdk/otel");
    const { generateText } =
      packageName === "ai-v7"
        ? await import("ai-v7")
        : await import("ai-v7-min");
    const { exporter, provider, tracer } = createHarness("ai");
    await generateText({
      model: {
        specificationVersion: "v4",
        provider: "mock-provider",
        modelId: "mock-model-id",
        supportedUrls: {},
        doGenerate: async () => ({
          content: [{ type: "text", text: "v7 response" }],
          finishReason: { unified: "stop", raw: "stop" },
          usage: v3AndV4Usage,
          warnings: [],
        }),
        doStream: async () => {
          throw new Error("Streaming is not used by this test");
        },
      },
      prompt: "v7 prompt",
      runtimeContext: { "tcc.runId": "v7-run", "tcc.sessionId": "v7-session" },
      telemetry: {
        integrations: new OpenTelemetry({ tracer, runtimeContext: true }),
        includeRuntimeContext: { "tcc.runId": true, "tcc.sessionId": true },
      },
    });
    await provider.forceFlush();
    const spans = exporter.getFinishedSpans();
    expect(spans.map(({ name }) => name)).toEqual(
      expect.arrayContaining([
        "invoke_agent mock-model-id",
        "step 1",
        "chat mock-model-id",
      ])
    );
    expect(
      spans.find(({ name }) => name === "invoke_agent mock-model-id")
        ?.attributes["ai.telemetry.metadata.tcc.runId"]
    ).toBe("v7-run");
    expect(
      spans.find(({ name }) => name === "invoke_agent mock-model-id")
        ?.attributes["ai.telemetry.metadata.tcc.sessionId"]
    ).toBe("v7-session");
    await provider.shutdown();
  };

  versionIt("7")("captures current AI SDK 7 telemetry", () => testV7("ai-v7"));
  versionIt("7-min")("captures minimum AI SDK 7 telemetry", () =>
    testV7("ai-v7-min")
  );
});

import type { ReadableSpan } from "@opentelemetry/sdk-trace-base";
import { describe, expect, it } from "vitest";
import {
  convertSpanToRun,
  convertSpanToToolCall,
  isRun,
  isStep,
  isToolCall,
} from "./converters";

const span = (name: string, attributes: Record<string, any>) =>
  ({
    name,
    attributes,
    instrumentationScope: { name: "gen_ai" },
    startTime: [1, 0],
    endTime: [2, 0],
    status: { code: 1 },
    spanContext: () => ({ traceId: "trace", spanId: "span" }),
  }) as unknown as ReadableSpan;

describe("local AI SDK 7 conversion", () => {
  it("shows native runs and chat steps without duplicate agent steps", () => {
    const run = span("invoke_agent model", {
      "gen_ai.operation.name": "invoke_agent",
      "gen_ai.input.messages": JSON.stringify([
        { role: "user", parts: [{ type: "text", content: "Hello" }] },
      ]),
      "gen_ai.output.messages": JSON.stringify([
        { role: "assistant", parts: [{ type: "text", content: "Hi" }] },
      ]),
      "gen_ai.usage.input_tokens": 2,
      "gen_ai.usage.output_tokens": 1,
    });
    expect(isRun(run)).toBe(true);
    expect(convertSpanToRun(run)).toMatchObject({
      prompt: "Hello",
      response: "Hi",
      promptTokens: 2,
      completionTokens: 1,
    });
    expect(
      isStep(span("step 1", { "gen_ai.operation.name": "agent_step" }))
    ).toBe(false);
    expect(
      isStep(span("chat model", { "gen_ai.operation.name": "chat" }))
    ).toBe(true);
  });

  it("shows native tool calls", () => {
    const tool = span("execute_tool weather", {
      "gen_ai.operation.name": "execute_tool",
      "gen_ai.tool.name": "weather",
      "gen_ai.tool.call.arguments": '{"city":"Tokyo"}',
      "gen_ai.tool.call.result": '{"temperature":68}',
    });
    expect(isToolCall(tool)).toBe(true);
    expect(convertSpanToToolCall(tool)).toMatchObject({
      toolName: "weather",
      toolArgs: '{"city":"Tokyo"}',
      toolResult: '{"temperature":68}',
    });
  });

  it("preserves native messages with string content", () => {
    const run = span("invoke_agent model", {
      "gen_ai.operation.name": "invoke_agent",
      "gen_ai.input.messages": JSON.stringify([
        { role: "user", content: "Hello as a string" },
      ]),
      "gen_ai.output.messages": JSON.stringify([
        { role: "assistant", content: "Hi as a string" },
      ]),
    });

    expect(convertSpanToRun(run)).toMatchObject({
      prompt: "Hello as a string",
      response: "Hi as a string",
    });
  });
});

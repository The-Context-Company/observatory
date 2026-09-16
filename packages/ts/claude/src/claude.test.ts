import * as sdk from "@anthropic-ai/claude-agent-sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { flushClaudeTelemetry, instrumentClaudeAgent } from "./claude";

describe("Claude instrumentation", () => {
  let payloads: any[];
  beforeEach(() => {
    payloads = [];
    vi.stubEnv("TCC_API_KEY", "dev_test");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url, init) => {
        payloads.push(JSON.parse(init.body));
        return { ok: true };
      })
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  function fixture(fail = false) {
    const messages = [
      {
        type: "assistant",
        message: { content: [{ type: "text", text: "Hi" }] },
      },
      { type: "result" },
    ];
    const query = vi.fn(
      (_params: { prompt: string; options?: { model: string } }) => {
        const stream = (async function* () {
          yield messages[0];
          if (fail) throw new Error("SDK failure");
          yield messages[1];
        })();
        return Object.assign(stream, {
          interrupt: vi.fn(async function (this: unknown) {
            expect(this).toBe(stream);
          }),
          setModel: vi.fn(async () => {}),
        });
      }
    );
    return { messages, query };
  }

  it("passes messages through, strips tcc, and awaits authenticated telemetry", async () => {
    const source = fixture();
    const agent = instrumentClaudeAgent(source);
    const options = { model: "test" };
    const result = agent.query({
      prompt: "hello",
      options,
      tcc: { runId: "run", sessionId: "session", conversational: true },
    });
    const received = [];
    for await (const message of result) received.push(message);
    expect(source.query).toHaveBeenCalledWith({ prompt: "hello", options });
    expect(received[0]).toBe(source.messages[0]);
    expect(payloads).toHaveLength(1);
    expect(payloads[0]).toMatchObject({
      runId: "run",
      sessionId: "session",
      userPrompt: "hello",
      customMetadata: { "tcc.conversational": true },
    });
    expect(payloads[0].messages[0]).toHaveProperty("receivedAtMs");
    expect(fetch).toHaveBeenCalledWith(
      "https://dev.thecontext.company/v1/claude",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer dev_test" }),
      })
    );
  });

  it("preserves controls before and during iteration", async () => {
    const source = fixture();
    const result = instrumentClaudeAgent(source).query({ prompt: "hello" });
    expect(result[Symbol.asyncIterator]()).toBe(result);
    await result.interrupt();
    await result.next();
    await result.setModel();
    await result.return();
    expect(payloads).toHaveLength(1);
  });

  it("sends partial telemetry exactly once after an early break", async () => {
    const result = instrumentClaudeAgent(fixture()).query({ prompt: "hello" });
    for await (const _ of result) break;
    await result.return();
    expect(payloads).toHaveLength(1);
    expect(payloads[0].messages).toHaveLength(1);
  });

  it("preserves SDK exceptions and exports partial messages", async () => {
    const result = instrumentClaudeAgent(fixture(true)).query({
      prompt: "hello",
    });
    await expect(
      (async () => {
        for await (const _ of result) {
        }
      })()
    ).rejects.toThrow("SDK failure");
    expect(payloads).toHaveLength(1);
  });

  it("does not fail the agent when telemetry fails", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("offline"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    for await (const _ of instrumentClaudeAgent(fixture()).query({
      prompt: "hello",
    })) {
    }
  });

  it("supports the latest SDK tool factory and MCP server", async () => {
    const agent = instrumentClaudeAgent(sdk);
    const tool = agent.tool(
      "echo",
      "Echo input",
      { text: z.string() },
      async ({ text }) => ({ content: [{ type: "text", text }] })
    );
    expect(await tool.handler({ text: "hello" }, {} as any)).toEqual({
      content: [{ type: "text", text: "hello" }],
    });
    const server = agent.createSdkMcpServer({ name: "test", tools: [tool] });
    expect(server.type).toBe("sdk");
    await server.instance.close();
  });

  it("captures streaming input without consuming it ahead of the SDK", async () => {
    const inputMessage = {
      type: "user",
      message: { role: "user", content: "streaming hello" },
    };
    async function* input() {
      yield inputMessage;
    }
    const source = {
      query: async function* ({ prompt }: { prompt: AsyncIterable<any> }) {
        for await (const message of prompt) expect(message).toBe(inputMessage);
        yield { type: "result" };
      },
    };
    for await (const _ of instrumentClaudeAgent(source).query({
      prompt: input(),
    })) {
    }
    expect(payloads[0].userPrompt).toBe("streaming hello");
  });

  it("close and flush finish partial telemetry", async () => {
    let closed = false;
    const source = {
      query: (_params: { prompt: string }) =>
        Object.assign(
          (async function* () {
            yield { type: "assistant" };
            yield { type: "result" };
          })(),
          {
            close() {
              closed = true;
            },
          }
        ),
    };
    const result = instrumentClaudeAgent(source).query({ prompt: "hello" });
    await result.next();
    result.close();
    await flushClaudeTelemetry();
    expect(closed).toBe(true);
    expect(payloads).toHaveLength(1);
  });

  it("return before iteration closes the original query", async () => {
    const source = fixture();
    const raw = source.query({ prompt: "hi" });
    const close = vi.spyOn(raw, "return");
    const result = instrumentClaudeAgent({
      query: (_params: { prompt: string }) => raw,
    }).query({ prompt: "hi" });
    await result.return();
    expect(close).toHaveBeenCalledOnce();
  });
});

import { createServer } from "node:http";
import tccPiExtension from "@contextcompany/pi/extension";

type Handler = (event: unknown, ctx: Record<string, never>) => unknown;

class FakePiApi {
  readonly handlers = new Map<string, Handler[]>();
  readonly commands = new Map<string, Handler>();

  on(event: string, handler: Handler): void {
    const handlers = this.handlers.get(event) ?? [];
    handlers.push(handler);
    this.handlers.set(event, handlers);
  }

  registerCommand(
    name: string,
    options: { description?: string; handler: Handler }
  ): void {
    this.commands.set(name, options.handler);
  }

  async emit(event: string, payload?: unknown): Promise<void> {
    for (const handler of this.handlers.get(event) ?? []) {
      await handler(payload, {});
    }
  }
}

async function startCollector(): Promise<{
  endpoint: string;
  payloads: unknown[];
  close: () => Promise<void>;
}> {
  const payloads: unknown[] = [];
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.from(chunk));
    }

    payloads.push(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
  });

  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not start local collector");
  }

  return {
    endpoint: `http://127.0.0.1:${address.port}/v1/pi`,
    payloads,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

async function main(): Promise<void> {
  const collector = await startCollector();
  process.env.TCC_API_KEY = "test-key";
  process.env.TCC_PI_ENDPOINT = collector.endpoint;
  process.env.TCC_DEBUG = "true";

  try {
    const pi = new FakePiApi();
    tccPiExtension(pi);

    await pi.emit("agent_start");
    await pi.emit("message_end", {
      message: { role: "user", content: "What is 2 + 2?" },
    });
    await pi.emit("tool_execution_start", {
      toolCallId: "tool-1",
      toolName: "calculator",
      args: { expression: "2 + 2" },
    });
    await pi.emit("tool_execution_end", {
      toolCallId: "tool-1",
      result: "4",
      isError: false,
    });
    await pi.emit("message_end", {
      message: { role: "assistant", content: "2 + 2 is 4." },
    });
    await pi.emit("agent_end");
    await pi.emit("session_shutdown");

    const status = await pi.commands.get("tcc-status")?.({}, {});
    console.log(status);
    console.log(JSON.stringify(collector.payloads, null, 2));

    if (collector.payloads.length !== 1) {
      throw new Error(`Expected 1 payload, got ${collector.payloads.length}`);
    }
  } finally {
    await collector.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

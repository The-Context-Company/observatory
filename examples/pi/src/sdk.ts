import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import {
  createAgentSession,
  DefaultResourceLoader,
} from "@mariozechner/pi-coding-agent";
import { instrumentPiSession } from "@contextcompany/pi";

config();

async function startCollector(): Promise<{
  endpoint: string;
  close: () => Promise<void>;
}> {
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.from(chunk));
    }

    const body = Buffer.concat(chunks).toString("utf8");
    console.log("\n[TCC collector] received Pi payload:");
    console.log(JSON.stringify(JSON.parse(body), null, 2));

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
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

async function main(): Promise<void> {
  const collector = await startCollector();
  const prompt = process.argv.slice(2).join(" ") || "Say hello in one sentence.";

  try {
    const resourceLoader = new DefaultResourceLoader({ noExtensions: true });
    await resourceLoader.reload();

    const { session } = await createAgentSession({ resourceLoader });
    const telemetry = instrumentPiSession(session, {
      apiKey: "test-key",
      endpoint: collector.endpoint,
      sessionId: randomUUID(),
      conversational: true,
      debug: true,
    });

    session.subscribe((event: any) => {
      if (
        event.type === "message_update" &&
        event.assistantMessageEvent?.type === "text_delta"
      ) {
        process.stdout.write(event.assistantMessageEvent.delta);
      }
    });

    await session.prompt(prompt);
    await telemetry.flush();
  } finally {
    await collector.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

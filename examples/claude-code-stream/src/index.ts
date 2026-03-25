import { Daytona } from "@daytonaio/sdk";
import {
  ClaudeCodeStreamCollector,
  type SDKMessage,
} from "@contextcompany/claude";

function printClaudeText(message: SDKMessage): void {
  if (message.type === "assistant" && Array.isArray(message.message?.content)) {
    for (const block of message.message.content) {
      if (block?.type === "text" && typeof block.text === "string") {
        process.stdout.write(block.text);
      }
    }
    return;
  }

  if (message.type === "stream_event") {
    const event = message.event;
    if (event?.type === "content_block_delta" && event.delta?.type === "text_delta") {
      process.stdout.write(event.delta.text);
    }
  }
}

async function main() {
  const daytona = new Daytona();
  const prompt = "Summarize the repository in one paragraph.";

  const collector = new ClaudeCodeStreamCollector({
    userPrompt: prompt,
    tcc: {
      sessionId: crypto.randomUUID(),
      metadata: {
        framework: "claude-code-cli",
        runtime: "daytona",
      },
    },
    onMessage: printClaudeText,
  });

  const sandbox = await daytona.create();

  try {
    await sandbox.process.executeCommand("npm install -g @anthropic-ai/claude-code");

    const pty = await sandbox.process.createPty({
      id: "claude",
      onData: (data) => {
        collector.ingest(data);
      },
    });

    await pty.waitForConnection();

    const command = [
      `ANTHROPIC_API_KEY=${process.env.ANTHROPIC_API_KEY}`,
      "claude",
      "--dangerously-skip-permissions",
      "-p",
      JSON.stringify(prompt),
      "--output-format",
      "stream-json",
      "--verbose",
      "--include-partial-messages",
    ].join(" ");

    pty.sendInput(`${command}\n`);
    await pty.wait();

    const result = await collector.finish();

    console.log("\n\n--- Trace Summary ---");
    console.log(`runId: ${result.runId}`);
    console.log(`sessionId: ${result.sessionId ?? "(none)"}`);
    console.log(`parsed messages: ${result.parsedMessages}`);
    console.log(`ignored lines: ${result.ignoredLines}`);
  } finally {
    await sandbox.delete();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

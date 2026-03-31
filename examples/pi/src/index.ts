import { config } from "dotenv";
import * as readline from "readline";
import { randomUUID } from "crypto";
import { createAgentSession } from "@mariozechner/pi-coding-agent";
import { instrumentPiSession } from "@contextcompany/pi";

config();

async function main() {
  console.log("🤖 Pi Agent SDK with TCC Instrumentation\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = (question: string): Promise<string> => {
    return new Promise((resolve) => rl.question(question, resolve));
  };

  const { session } = await createAgentSession();

  instrumentPiSession(session, {
    sessionId: randomUUID(),
    conversational: true,
  });

  session.subscribe((event: any) => {
    if (event.type === "message_update" && event.assistantMessageEvent?.type === "text_delta") {
      process.stdout.write(event.assistantMessageEvent.delta);
    }
  });

  while (true) {
    const userPrompt = await ask("You: ");
    const trimmed = userPrompt.trim();

    if (!trimmed || trimmed.toLowerCase() === "exit") {
      console.log("👋 Goodbye!");
      rl.close();
      break;
    }

    await session.prompt(trimmed);
    console.log();
  }
}

main().catch(console.error);

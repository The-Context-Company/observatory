import "dotenv/config";
import { mastra } from "./mastra/index.js";
import * as readline from "readline";
import { randomUUID } from "crypto";

async function main() {
  const agent = mastra.getAgent("weatherAgent");

  if (!agent) {
    console.error("Weather agent not found");
    process.exit(1);
  }

  console.log("\n🌤️  Mastra Weather Agent with TCC");
  console.log("Ask about weather in any city!");
  console.log('Type "exit" or "quit" to end the session\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = (question: string): Promise<string> => {
    return new Promise((resolve) => rl.question(question, resolve));
  };

  // TCC: Generate session ID to track this conversation
  const sessionId = randomUUID();
  let queryCount = 0;

  console.log(`[Session ID: ${sessionId}]\n`);

  while (true) {
    const userInput = await ask("You: ");
    const trimmed = userInput.trim();

    if (!trimmed) continue;

    if (trimmed.toLowerCase() === "exit" || trimmed.toLowerCase() === "quit") {
      console.log("\n👋 Goodbye!\n");
      rl.close();
      break;
    }

    try {
      queryCount++;

      // TCC: Generate unique run ID for this AI call
      const tccRunId = randomUUID();
      console.log(`[Run ID: ${tccRunId}]`);

      const response = await agent.stream(
        [{ role: "user", content: trimmed }],
        {
          // TCC: Pass metadata to track and filter this execution
          tracingOptions: {
            metadata: {
              "tcc.runId": tccRunId, // TCC: Unique ID for this AI call
              "tcc.sessionId": sessionId, // TCC: Session tracking across multiple queries

              // TCC: Add your own custom metadata for filtering in dashboard
              userId: "user-123",
              queryNumber: queryCount,
              environment: "development",
            },
          },
        }
      );

      console.log("\nAgent: ");

      for await (const chunk of response.textStream) {
        process.stdout.write(chunk);
      }

      console.log("\n");
    } catch (error) {
      console.error("Error:", error);
    }

    // Wait briefly for traces to be exported
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

main();

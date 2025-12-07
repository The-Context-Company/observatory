import "dotenv/config";
import { mastra } from "./mastra/index.js";
import { submitFeedback } from "@contextcompany/mastra";
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
  console.log('Type "up" for 👍, "down" for 👎, or "exit" to quit\n');

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
  let previousRunId: string | null = null;

  console.log(`[Session ID: ${sessionId}]\n`);

  while (true) {
    const userInput = await ask("\nYou: ");
    const trimmed = userInput.trim();

    if (!trimmed || trimmed.toLowerCase() === "exit") {
      console.log("\n👋 Goodbye!\n");
      rl.close();
      break;
    }

    // Handle feedback for previous run
    if (trimmed.toLowerCase() === "up" || trimmed.toLowerCase() === "down") {
      if (!previousRunId) {
        console.log("\n⚠️  No previous run to give feedback on\n");
        continue;
      }

      const score =
        trimmed.toLowerCase() === "up" ? "thumbs_up" : "thumbs_down";
      console.log(
        `\n${score === "thumbs_up" ? "👍" : "👎"} Submitting feedback...`
      );

      const response = await submitFeedback({ runId: previousRunId, score });
      console.log(
        response?.ok
          ? "✅ Feedback submitted!\n"
          : "❌ Failed to submit feedback\n"
      );
      continue;
    }

    try {
      queryCount++;

      // TCC: Generate unique run ID for this AI call
      const tccRunId = randomUUID();

      const response = await agent.stream(
        [{ role: "user", content: trimmed }],
        {
          // TCC: Pass metadata to track and filter this execution
          tracingOptions: {
            metadata: {
              "tcc.runId": tccRunId, // TCC: Unique ID for this AI call
              "tcc.sessionId": sessionId, // TCC: Session tracking across multiple queries

              // TCC: Add your own custom metadata for filtering in dashboard
              customMetadata1: "1234567890",
              customMetadata2: "context is key",
            },
          },
        }
      );

      console.log("\nAgent:");

      for await (const chunk of response.textStream) {
        process.stdout.write(chunk);
      }

      console.log("\n");

      previousRunId = tccRunId;
    } catch (error) {
      console.error("Error:", error);
    }

    // Wait briefly for traces to be exported
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

main();

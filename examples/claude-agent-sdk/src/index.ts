import { randomUUID } from "crypto";
import * as readline from "readline";
import * as claudeSDK from "@anthropic-ai/claude-agent-sdk";
import { instrumentClaudeAgent, submitFeedback } from "@contextcompany/claude";
import { config } from "dotenv";
import { z } from "zod";

config();

// Wrap Claude Agent SDK with TCC instrumentation for telemetry
const { query, tool, createSdkMcpServer } = instrumentClaudeAgent(claudeSDK);

// Mock user database
const USERS = {
  "user-001": {
    name: "Alice Johnson",
    email: "alice@example.com",
    plan: "pro",
  },
  "user-002": { name: "Bob Smith", email: "bob@example.com", plan: "free" },
  "user-003": {
    name: "Carol White",
    email: "carol@example.com",
    plan: "enterprise",
  },
};

// Define tool to get user information
const getUserInfo = tool(
  "get_user_info",
  "Get user information by user ID",
  { user_id: z.string().describe("User ID (e.g., user-001)") },
  async (args) => {
    const user = USERS[args.user_id as keyof typeof USERS];

    if (!user) {
      return {
        content: [{ type: "text", text: `User ${args.user_id} not found` }],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `User: ${user.name}\nEmail: ${user.email}\nPlan: ${user.plan}`,
        },
      ],
    };
  }
);

// Create MCP server with tools
const server = createSdkMcpServer({
  name: "user-agent",
  version: "1.0.0",
  tools: [getUserInfo],
});

async function main() {
  console.log("🤖 Claude Agent SDK with TCC Instrumentation");
  console.log("Available users: user-001, user-002, user-003");
  console.log('Type "up" for 👍, "down" for 👎, or "exit" to quit\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = (question: string): Promise<string> => {
    return new Promise((resolve) => rl.question(question, resolve));
  };

  const sessionId = randomUUID();
  let previousRunId: string | null = null;

  while (true) {
    const userPrompt = await ask("\nYou: ");
    const trimmed = userPrompt.trim();

    if (!trimmed || trimmed.toLowerCase() === "exit") {
      console.log("\n👋 Goodbye!");
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

    // Process query with TCC telemetry
    try {
      const currentRunId = randomUUID();

      const result = query({
        prompt: trimmed,
        options: {
          systemPrompt:
            "You are a helpful assistant. Use the get_user_info tool to answer questions about users. Available users are user-001, user-002, user-003.",
          mcpServers: { users: server },
          settingSources: [],
          tools: [],
          allowedTools: ["mcp__users__get_user_info"],
        },
        tcc: {
          runId: currentRunId,
          conversational: true,
          sessionId: sessionId,
          metadata: {
            userId: "1234567890",
          },
        },
      });

      console.log("\nAssistant:");
      for await (const message of result) {
        if (message.type === "assistant" && (message as any).message?.content) {
          for (const block of (message as any).message.content) {
            if (block.type === "text") {
              console.log(block.text);
            }
          }
        }
      }

      previousRunId = currentRunId;
    } catch (error) {
      console.error("Error:", error);
    }
  }
}

main().catch(console.error);

import { configure, run, sendRun } from "@contextcompany/custom";
import { config } from "dotenv";
import { runAgent } from "./agent";
import { TOOL_DEFINITIONS } from "./tools";

config();

configure({ debug: true, url: "http://localhost:8787/custom" });

// ═══════════════════════════════════════════════════════════════════════════
// Pattern 1: Builder — instrument as you go
//
// Use this when you're wrapping live agent execution and recording events
// in real time. Steps and tool calls are batched with the run and sent in
// a single request when you call run.end().
// ═══════════════════════════════════════════════════════════════════════════

async function builderExample() {
  console.log("\n" + "═".repeat(60));
  console.log("Pattern 1: Builder (on-the-fly instrumentation)");
  console.log("═".repeat(60));

  const sessionId = crypto.randomUUID();
  const userMessage = "What were our Q3 revenue numbers?";

  console.log(`\nUser: ${userMessage}`);

  // Start a run — the clock starts now
  const r = run({ sessionId, conversational: true });
  r.prompt(userMessage);
  r.metadata({ agent: "research", framework: "custom" });

  try {
    const { response, llmCalls, toolResults } = await runAgent(userMessage);

    // Record each LLM call as a step
    for (const llmCall of llmCalls) {
      const s = r.step();
      s.prompt(JSON.stringify([{ role: "user", content: userMessage }]));
      s.response(llmCall.content);
      s.model({ requested: "gpt-4o", used: llmCall.model });
      s.finishReason(llmCall.finishReason);
      s.tokens({
        uncached: llmCall.usage.promptTokens,
        cached: llmCall.usage.cachedTokens,
        completion: llmCall.usage.completionTokens,
      });
      s.toolDefinitions(TOOL_DEFINITIONS);
      s.end();
    }

    // Record each tool execution
    for (const t of toolResults) {
      const tc = r.toolCall(t.tool);
      tc.args(t.args);
      tc.result(t.result);
      tc.end();

      console.log(`  [${t.tool}] ${JSON.stringify(t.args)} → ${t.result}`);
    }

    r.response(response);
    await r.end();

    console.log(`\nAgent: ${response}`);
    console.log(
      `✓ Run ${r.runId} sent (batch: 1 run + ${llmCalls.length} steps + ${toolResults.length} tool calls)`
    );
  } catch (e) {
    await r.error(String(e));
    console.error("Agent error:", e);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Pattern 1b: Builder — error handling
//
// When a run errors, calling r.error() auto-ends any un-ended children
// with error status and sends everything in one batch.
// ═══════════════════════════════════════════════════════════════════════════

async function builderErrorExample() {
  console.log("\n" + "═".repeat(60));
  console.log("Pattern 1b: Builder (error handling)");
  console.log("═".repeat(60));

  const r = run();
  r.prompt("Do something that fails");

  const s = r.step();
  s.prompt("...");
  s.response("partial response before crash");
  // deliberately NOT calling s.end() — r.error() will handle it

  try {
    throw new Error("LLM provider returned 500");
  } catch (e) {
    await r.error(String(e));
    console.log(`✓ Error run ${r.runId} sent (un-ended step auto-closed)`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Pattern 2: Factory — send pre-built data
//
// Use this when all data is already available: post-hoc logging, batch
// imports, replaying from logs, or migrating from another system.
// ═══════════════════════════════════════════════════════════════════════════

async function factoryExample() {
  console.log("\n" + "═".repeat(60));
  console.log("Pattern 2: Factory (pre-built data)");
  console.log("═".repeat(60));

  const now = new Date();
  const later = new Date(now.getTime() + 2_300);

  await sendRun({
    prompt: "Create a ticket to investigate the churn spike",
    response:
      "Done — created ticket ENG-4521 (high priority) assigned to the oncall team.",
    startTime: now,
    endTime: later,
    sessionId: crypto.randomUUID(),
    conversational: true,
    metadata: { agent: "action", framework: "custom" },

    steps: [
      {
        prompt: JSON.stringify([
          { role: "system", content: "You are an Action Agent." },
          {
            role: "user",
            content: "Create a ticket to investigate the churn spike",
          },
        ]),
        response: "",
        model: { requested: "gpt-4o", used: "gpt-4o-2024-08-06" },
        finishReason: "tool_calls",
        tokens: { uncached: 280, completion: 60 },
        startTime: now,
        endTime: new Date(now.getTime() + 800),
      },
      {
        prompt: JSON.stringify([
          { role: "system", content: "You are an Action Agent." },
          {
            role: "user",
            content: "Create a ticket to investigate the churn spike",
          },
          {
            role: "tool",
            content: '{"ticket_id":"ENG-4521","status":"created"}',
          },
        ]),
        response:
          "Done — created ticket ENG-4521 (high priority) assigned to the oncall team.",
        model: "gpt-4o",
        finishReason: "stop",
        tokens: { uncached: 420, cached: 280, completion: 45 },
        cost: 0.0038,
        startTime: new Date(now.getTime() + 800),
        endTime: new Date(now.getTime() + 1_450),
      },
    ],

    toolCalls: [
      {
        name: "create_ticket",
        args: { title: "Investigate Q2→Q3 churn spike", priority: "high" },
        result: {
          ticket_id: "ENG-4521",
          status: "created",
          assigned_to: "oncall-team",
        },
        startTime: new Date(now.getTime() + 800),
        endTime: new Date(now.getTime() + 850),
      },
    ],
  });

  console.log("✓ Pre-built run sent (1 run + 2 steps + 1 tool call)");
}

// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log("@contextcompany/custom — Example");
  console.log("Demonstrates both builder and factory patterns.\n");

  await builderExample();
  await builderErrorExample();
  await factoryExample();

  console.log("\n" + "═".repeat(60));
  console.log("All examples complete.");
}

main().catch(console.error);

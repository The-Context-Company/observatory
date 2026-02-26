import { executeTool, TOOL_DEFINITIONS, type ToolResult } from "./tools";

// Simulated LLM responses for the demo — no real API keys needed.

type LLMResponse = {
  content: string;
  model: string;
  finishReason: string;
  toolCalls?: { name: string; args: Record<string, unknown> }[];
  usage: { promptTokens: number; cachedTokens: number; completionTokens: number };
  latencyMs: number;
};

const SCRIPTED_RESPONSES: Record<string, LLMResponse[]> = {
  "What were our Q3 revenue numbers?": [
    {
      content: "",
      model: "gpt-4o-2024-08-06",
      finishReason: "tool_calls",
      toolCalls: [
        { name: "search_knowledge_base", args: { query: "Q3 revenue" } },
        { name: "query_database", args: { sql: "SELECT * FROM metrics WHERE quarter = 'Q3'" } },
      ],
      usage: { promptTokens: 320, cachedTokens: 40, completionTokens: 85 },
      latencyMs: 1200,
    },
    {
      content:
        "Based on the Q3 2024 Report and our analytics database, Q3 revenue was $4.2M — up 18% from Q2's $3.56M. NPS also improved from 65 to 72.",
      model: "gpt-4o-2024-08-06",
      finishReason: "stop",
      usage: { promptTokens: 580, cachedTokens: 320, completionTokens: 120 },
      latencyMs: 950,
    },
  ],
  "Create a ticket to investigate the churn spike": [
    {
      content: "",
      model: "gpt-4o-2024-08-06",
      finishReason: "tool_calls",
      toolCalls: [
        { name: "create_ticket", args: { title: "Investigate Q2→Q3 churn spike", priority: "high" } },
      ],
      usage: { promptTokens: 280, cachedTokens: 0, completionTokens: 60 },
      latencyMs: 800,
    },
    {
      content: "Done — created ticket ENG-4521 (high priority) assigned to the oncall team.",
      model: "gpt-4o-2024-08-06",
      finishReason: "stop",
      usage: { promptTokens: 420, cachedTokens: 280, completionTokens: 45 },
      latencyMs: 650,
    },
  ],
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Simulate a multi-turn agent execution.
 * Returns the final response text plus all tool executions that happened.
 */
export async function runAgent(
  userMessage: string
): Promise<{ response: string; llmCalls: LLMResponse[]; toolResults: ToolResult[] }> {
  const script = SCRIPTED_RESPONSES[userMessage];
  if (!script) {
    const fallback: LLMResponse = {
      content: "I don't have data on that. Could you rephrase?",
      model: "gpt-4o-2024-08-06",
      finishReason: "stop",
      usage: { promptTokens: 150, cachedTokens: 0, completionTokens: 30 },
      latencyMs: 400,
    };
    await delay(fallback.latencyMs);
    return { response: fallback.content, llmCalls: [fallback], toolResults: [] };
  }

  const llmCalls: LLMResponse[] = [];
  const toolResults: ToolResult[] = [];

  for (const llmResponse of script) {
    await delay(llmResponse.latencyMs);
    llmCalls.push(llmResponse);

    if (llmResponse.toolCalls) {
      for (const tc of llmResponse.toolCalls) {
        const result = executeTool(tc.name, tc.args);
        toolResults.push({ tool: tc.name, args: tc.args, result });
      }
    }
  }

  const finalResponse = script[script.length - 1].content;
  return { response: finalResponse, llmCalls, toolResults };
}

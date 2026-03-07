import {
  setGlobalHandler,
  TCCCallbackHandler,
} from "@contextcompany/langchain";
import type { TCCInvokeMetadata } from "@contextcompany/langchain";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import {
  Annotation,
  MessagesAnnotation,
  StateGraph,
} from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { config } from "dotenv";
import { z } from "zod";

config();

// ── Tools ───────────────────────────────────────────────────────────────

const lookupOrder = tool(
  async ({ orderId }) => {
    const orders: Record<string, { status: string; items: string }> = {
      "ORD-1001": { status: "shipped", items: "2x Widget, 1x Gadget" },
      "ORD-1002": { status: "processing", items: "1x Thingamajig" },
      "ORD-1003": { status: "delivered", items: "3x Doohickey" },
    };
    const order = orders[orderId];
    if (!order) return `Order ${orderId} not found.`;
    return `Order ${orderId}: status=${order.status}, items=${order.items}`;
  },
  {
    name: "lookup_order",
    description: "Look up an order by its ID",
    schema: z.object({
      orderId: z.string().describe("The order ID (e.g. ORD-1001)"),
    }),
  }
);

const checkInventory = tool(
  async ({ product }) => {
    const stock: Record<string, number> = {
      widget: 142,
      gadget: 0,
      thingamajig: 37,
      doohickey: 85,
    };
    const count = stock[product.toLowerCase()];
    if (count === undefined) return `Unknown product: ${product}`;
    if (count === 0) return `${product} is OUT OF STOCK.`;
    return `${product}: ${count} units in stock.`;
  },
  {
    name: "check_inventory",
    description: "Check current inventory for a product",
    schema: z.object({
      product: z.string().describe("Product name"),
    }),
  }
);

const tools = [lookupOrder, checkInventory];

// ── Graph ───────────────────────────────────────────────────────────────

const GraphAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
});

const model = new ChatOpenAI({ model: "gpt-4o-mini" }).bindTools(tools);

const SYSTEM_PROMPT = `You are a helpful customer support assistant for an e-commerce store.
You can look up orders and check inventory. Be concise and helpful.
Only call ONE tool at a time.`;

async function callModel(state: typeof GraphAnnotation.State) {
  const response = await model.invoke([
    new SystemMessage(SYSTEM_PROMPT),
    ...state.messages,
  ]);
  return { messages: [response] };
}

function shouldContinue(state: typeof GraphAnnotation.State) {
  const last = state.messages[state.messages.length - 1] as AIMessage;
  if (last.tool_calls && last.tool_calls.length > 0) return "tools";
  return "__end__";
}

const graph = new StateGraph(GraphAnnotation)
  .addNode("agent", callModel)
  .addNode("tools", new ToolNode(tools))
  .addEdge("__start__", "agent")
  .addConditionalEdges("agent", shouldContinue)
  .addEdge("tools", "agent")
  .compile();

// ── Helpers ─────────────────────────────────────────────────────────────

function lastAssistantText(messages: BaseMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (
      msg instanceof AIMessage &&
      typeof msg.content === "string" &&
      msg.content
    ) {
      return msg.content;
    }
  }
  return "(no text response)";
}

// ── Main: metadata overrides demo ───────────────────────────────────────
//
// A single global handler is configured once with default metadata.
// Each graph.invoke() call passes per-invocation overrides through
// LangChain's `metadata` field:
//   - `tcc: { ... }` for TCC-specific config (runId, sessionId, conversational)
//   - everything else is automatically tracked as custom metadata

async function main() {
  console.log("═══ Metadata Overrides Demo ═══\n");

  // One global handler with default metadata.
  // Per-invocation overrides are passed via LangChain's `metadata` field:
  //   - `tcc: { ... }` for TCC-specific config (runId, sessionId, conversational)
  //   - everything else is automatically tracked as custom metadata
  setGlobalHandler(
    new TCCCallbackHandler({
      metadata: { agent: "support-bot", environment: "staging" },
      debug: true,
      // endpoint: "http://localhost:8787/v1/custom",
    })
  );

  const result = await graph.invoke(
    { messages: [new HumanMessage("Look up order ORD-1002")] },
    {
      metadata: {
        tcc: {
          sessionId: "session-99",
          conversational: true,
        },
        user_id: "user-7",
        tenant: "acme-corp",
        support_tier: "premium",
      } satisfies TCCInvokeMetadata,
    }
  );

  console.log(`Assistant: ${lastAssistantText(result.messages)}\n`);
}

main().catch(console.error);

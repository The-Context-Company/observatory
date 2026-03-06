import { config } from "dotenv";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { tool } from "@langchain/core/tools";
import {
  Annotation,
  StateGraph,
  MessagesAnnotation,
} from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { AIMessage, SystemMessage } from "@langchain/core/messages";
import {
  TCCCallbackHandler,
  setGlobalHandler,
} from "@contextcompany/langchain";

config();

// ── One-line TCC setup ──────────────────────────────────────────────────
setGlobalHandler(
  new TCCCallbackHandler({
    metadata: { agent: "travel-planner", framework: "langgraph" },
    debug: true,
  })
);

// ── Tools ───────────────────────────────────────────────────────────────

const getWeather = tool(
  async ({ city }) => {
    const forecasts: Record<string, string> = {
      "san francisco": "62°F, foggy with afternoon clearing",
      "new york": "45°F, cloudy with chance of rain",
      tokyo: "73°F, sunny and humid",
      london: "52°F, rainy with strong winds",
      paris: "58°F, partly cloudy",
    };
    const forecast = forecasts[city.toLowerCase()];
    if (!forecast) return `No weather data available for ${city}.`;
    return `Current weather in ${city}: ${forecast}`;
  },
  {
    name: "get_weather",
    description: "Get the current weather for a city",
    schema: z.object({
      city: z.string().describe("The city to get weather for"),
    }),
  }
);

const getAttractions = tool(
  async ({ city }) => {
    const attractions: Record<string, string[]> = {
      "san francisco": ["Golden Gate Bridge", "Alcatraz Island", "Fisherman's Wharf"],
      "new york": ["Central Park", "Statue of Liberty", "Times Square"],
      tokyo: ["Senso-ji Temple", "Shibuya Crossing", "Meiji Shrine"],
      london: ["Tower of London", "British Museum", "Buckingham Palace"],
      paris: ["Eiffel Tower", "Louvre Museum", "Notre-Dame Cathedral"],
    };
    const list = attractions[city.toLowerCase()];
    if (!list) return `No attraction data available for ${city}.`;
    return `Top attractions in ${city}: ${list.join(", ")}`;
  },
  {
    name: "get_attractions",
    description: "Get top tourist attractions for a city",
    schema: z.object({
      city: z.string().describe("The city to get attractions for"),
    }),
  }
);

const getFlightEstimate = tool(
  async ({ from, to }) => {
    const estimates: Record<string, string> = {
      "san francisco->tokyo": "~11h, $850 round-trip",
      "new york->london": "~7h, $650 round-trip",
      "new york->paris": "~7.5h, $700 round-trip",
      "london->paris": "~1h (or 2.5h by Eurostar), $150 round-trip",
    };
    const key = `${from.toLowerCase()}->${to.toLowerCase()}`;
    const estimate = estimates[key];
    if (!estimate) return `No flight data for ${from} → ${to}.`;
    return `Flight from ${from} to ${to}: ${estimate}`;
  },
  {
    name: "get_flight_estimate",
    description: "Get estimated flight duration and cost between two cities",
    schema: z.object({
      from: z.string().describe("Departure city"),
      to: z.string().describe("Destination city"),
    }),
  }
);

const tools = [getWeather, getAttractions, getFlightEstimate];

// ── Graph ───────────────────────────────────────────────────────────────

const GraphAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
});

const model = new ChatOpenAI({ model: "gpt-4o-mini" }).bindTools(tools);

const SYSTEM_PROMPT = `You are a helpful travel planning assistant.

IMPORTANT RULES:
1. Only call ONE tool at a time. Never call multiple tools in a single response.
2. Before each tool call, briefly explain what you are about to look up and why.
3. After receiving tool results, explain what you learned before making the next tool call.
4. When you have gathered all the information you need, give a final comprehensive summary.

When a user asks about a trip, gather weather, attractions, and flight info step by step.`;

async function callModel(state: typeof GraphAnnotation.State) {
  const messagesWithSystem = [
    new SystemMessage(SYSTEM_PROMPT),
    ...state.messages,
  ];
  const response = await model.invoke(messagesWithSystem);
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

// ── Run ─────────────────────────────────────────────────────────────────

async function main() {
  console.log("LangGraph Travel Planner + TCC Example\n");

  const result = await graph.invoke({
    messages: [
      {
        role: "user",
        content:
          "I'm in New York and thinking about visiting Tokyo. " +
          "Can you check the weather in Tokyo, find the top attractions, " +
          "and get a flight estimate from New York?",
      },
    ],
  });

  const last = result.messages[result.messages.length - 1];
  console.log(`\nFinal answer:\n${last.content}\n`);
}

main().catch(console.error);

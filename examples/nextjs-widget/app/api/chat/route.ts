import { openai } from "@ai-sdk/openai";
import {
  streamText,
  UIMessage,
  convertToModelMessages,
  tool,
  stepCountIs,
} from "ai";
import { z } from "zod";

const getWeather = tool({
  description: "Get the weather for a given city",
  inputSchema: z.object({
    city: z.string(),
  }),
  execute: async ({ city }) => {
    return `The weather in ${city} is sunny`;
  },
});

const createTicket = tool({
  description: "Create a new ticket",
  inputSchema: z.object({
    title: z.string(),
    description: z.string(),
  }),
  execute: async ({ title, description }) => {
    throw new Error("Error: Failed to connect to the database");
    return `Ticket created: ${title} - ${description}`;
  },
});

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: openai("gpt-4o"),
    messages: convertToModelMessages(messages),
    tools: { getWeather, createTicket },
    stopWhen: stepCountIs(10),
    experimental_telemetry: {
      isEnabled: true,
      metadata: {
        version: "AI SDK 5 (old)",
        aiSdkVersion: "5",
      },
    },
  });

  return result.toUIMessageStreamResponse();
}

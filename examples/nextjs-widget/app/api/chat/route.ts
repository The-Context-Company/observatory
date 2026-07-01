import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import { convertToModelMessages, stepCountIs, streamText, tool } from "ai";
import { z } from "zod";
import { authorizeExampleRequest } from "../_example-auth";
import { enforceExampleRateLimit, readChatRequest } from "../_example-guard";

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
  const unauthorized = authorizeExampleRequest(req);
  if (unauthorized) return unauthorized;

  const rateLimited = enforceExampleRateLimit(req, "chat");
  if (rateLimited) return rateLimited;

  const parsed = await readChatRequest(req);
  if (!parsed.ok) return parsed.response;

  let modelMessages;
  try {
    modelMessages = convertToModelMessages(parsed.data.messages);
  } catch {
    return NextResponse.json(
      { error: "Invalid messages payload" },
      { status: 400 }
    );
  }

  const result = streamText({
    model: openai("gpt-4o"),
    messages: modelMessages,
    tools: { getWeather, createTicket },
    stopWhen: stepCountIs(10),
    experimental_telemetry: { isEnabled: true },
  });

  return result.toUIMessageStreamResponse();
}

import { openai } from "@ai-sdk/openai";
import { convertToModelMessages, streamText, stepCountIs } from "ai";
import { randomUUID } from "crypto";
import { weatherTools } from "./agent";

export const maxDuration = 60;

export async function POST(req: Request) {
  const body = await req.json();
  const { messages } = body;

  // TCC tracking IDs
  const sessionId = body.sessionId; // Track conversation session across requests
  const runId = randomUUID(); // Track this specific AI call

  const result = streamText({
    model: openai("gpt-4o"),
    messages: await convertToModelMessages(messages),
    system: `You are a helpful weather assistant. Use getLocation to suggest a city, or getWeather to check the weather for a specific location.`,
    tools: weatherTools,
    stopWhen: stepCountIs(10),
    // TCC: Enable telemetry to track this AI interaction
    experimental_telemetry: {
      isEnabled: true,
      metadata: {
        "tcc.runId": runId, // TCC: Special Unique ID for this AI call
        "tcc.sessionId": sessionId, // TCC: Special Unique ID for conversation tracking

        // TCC: Add your own metadata here (to filter and group events in dashboard)
        yourCustomMetadata: "yourCustomValue",
        yourCustomMetadata2: "yourCustomValue2",
      },
    },
  });

  return result.toUIMessageStreamResponse({
    messageMetadata: () => ({ runId }), // Send runId to client for feedback submission
  });
}

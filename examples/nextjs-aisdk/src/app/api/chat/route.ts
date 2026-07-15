import { randomUUID } from "crypto";
import { openai } from "@ai-sdk/openai";
import { tccTelemetry } from "@contextcompany/ai-sdk/nextjs";
import { convertToModelMessages, isStepCount, streamText } from "ai";
import { authorizeExampleRequest } from "../_example-auth";
import { weatherTools } from "./agent";

export const maxDuration = 60;

export async function POST(req: Request) {
  const unauthorized = authorizeExampleRequest(req);
  if (unauthorized) return unauthorized;

  const body = await req.json();
  const { messages } = body;

  // TCC tracking IDs
  const sessionId = body.sessionId; // Track conversation session across requests
  const runId = randomUUID(); // Track this specific AI call
  const result = streamText({
    model: openai("gpt-4o"),
    messages: await convertToModelMessages(messages),
    instructions: `You are a helpful weather assistant. Use getLocation to suggest a city, or getWeather to check the weather for a specific location.`,
    tools: weatherTools,
    stopWhen: isStepCount(10),
    ...tccTelemetry({
      metadata: {
        "tcc.runId": runId,
        "tcc.sessionId": sessionId,
        "tcc.userId": "1234567890",
        "tcc.userName": "John Doe",
        "tcc.orgId": "178943",
        "tcc.orgName": "Acme Inc",
        "tcc.agent": "weather-assistant",
        version: "AI SDK 7 (new)",
        aiSdkVersion: "7",
        yourCustomMetadata: "yourCustomValue",
        yourCustomMetadata2: "yourCustomValue2",
      },
    }),
  });

  return result.toUIMessageStreamResponse({
    messageMetadata: () => ({ runId }), // Send runId to client for feedback submission
  });
}

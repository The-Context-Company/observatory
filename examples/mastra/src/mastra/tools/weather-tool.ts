import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const locations = [
  "Tampa",
  "San Francisco",
  "New York",
  "London",
  "Tokyo",
  "Sydney",
];

const mockWeather: Record<
  string,
  { temp: number; condition: string; humidity: number }
> = {
  Tampa: { temp: 80, condition: "Sunny", humidity: 77 },
  "San Francisco": { temp: 62, condition: "Foggy", humidity: 75 },
  "New York": { temp: 45, condition: "Cloudy", humidity: 60 },
  London: { temp: 52, condition: "Rainy", humidity: 85 },
  Tokyo: { temp: 68, condition: "Sunny", humidity: 55 },
  Sydney: { temp: 75, condition: "Clear", humidity: 50 },
};

export const getLocationTool = createTool({
  id: "get-location",
  description: "Get a random location to check weather for",
  inputSchema: z.object({}),
  outputSchema: z.object({
    location: z.string(),
  }),
  execute: async () => {
    const location = locations[Math.floor(Math.random() * locations.length)];
    return { location };
  },
});

export const getWeatherTool = createTool({
  id: "get-weather",
  description: "Get current weather for a specific location",
  inputSchema: z.object({
    location: z.string().describe("City name"),
  }),
  outputSchema: z.object({
    location: z.string(),
    temp: z.number(),
    condition: z.string(),
    humidity: z.number(),
  }),
  execute: async ({ context }) => {
    const weather = mockWeather[context.location];

    if (!weather) {
      throw new Error(
        `Location not found. Try: Tampa, San Francisco, New York, London, Tokyo, or Sydney`
      );
    }

    return {
      location: context.location,
      ...weather,
    };
  },
});

import { Agent } from '@mastra/core/agent';
import { getLocationTool, getWeatherTool } from '../tools/weather-tool';

export const weatherAgent = new Agent({
  name: 'Weather Agent',
  instructions: `You are a helpful weather assistant.

Use get-location to suggest a random city, or get-weather to check weather for a specific location.
Available cities: Tampa, San Francisco, New York, London, Tokyo, Sydney.

Keep responses concise and friendly.`,
  model: 'openai/gpt-4o-mini',
  tools: { getLocationTool, getWeatherTool },
});

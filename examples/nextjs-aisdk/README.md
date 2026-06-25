# Next.js + AI SDK + The Context Company Integration

A simple example demonstrating The Context Company (TCC) telemetry integration with the Vercel AI SDK in a Next.js application, featuring a weather assistant with tool calling and feedback tracking.

## Overview

This example shows best practices for:

- Integrating TCC OpenTelemetry with Next.js and AI SDK
- Building AI agents with tool calling
- Implementing user feedback with runId/sessionId tracking
- Managing streaming responses with proper metadata

## Features

### Weather Assistant

A minimal agent demonstrating tool calling with:

- **getLocation**: Returns a random city from a list
- **getWeather**: Returns mock weather data for a specified location

### Telemetry & Observability

- Full TCC integration with runId and sessionId tracking
- Automatic trace collection for all AI interactions
- Tool call tracking and performance metrics

### User Feedback System

- Thumbs up/down quick feedback
- Text comments for detailed feedback
- All feedback linked to specific AI responses via runId

## Getting Started

### Prerequisites

- Node.js 18+ or compatible runtime
- OpenAI API key
- TCC account (optional for local development)

### Installation

1. **Clone and navigate to the example:**

```bash
cd examples/nextjs-aisdk
```

2. **Install dependencies:**

```bash
npm install
# or
pnpm install
# or
yarn install
```

3. **Configure environment variables:**

```bash
cp .env.example .env
```

Edit `.env` and add your API keys:

```env
OPENAI_API_KEY=your_openai_api_key_here
TCC_EXAMPLE_API_TOKEN=choose_a_local_demo_token
NEXT_PUBLIC_TCC_EXAMPLE_API_TOKEN=choose_a_local_demo_token

# Optional for local development with TCC backend
TCC_API_KEY=your_tcc_api_key_here
TCC_URL=http://localhost:8787/v1/traces
TCC_FEEDBACK_URL=http://localhost:8787/v1/feedback
```

The example API routes require the demo token above by default. For throwaway local-only testing, you can set `TCC_ALLOW_UNAUTHENTICATED_EXAMPLE_APIS=1`; do not use that setting for deployed examples.

4. **Run the development server:**

```bash
npm run dev
```

5. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Usage Examples

Try these prompts to see the agent in action:

**Direct Weather Queries:**

- "What's the weather in Tokyo?"
- "Check the weather in San Francisco"
- "Is it rainy in London?"

**Random Location:**

- "Pick a random city and tell me the weather"
- "Surprise me with a location"

The agent will use the appropriate tools (getLocation and/or getWeather) to respond.

## Architecture

### Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── chat/
│   │   │   └── route.ts              # Chat endpoint with agent definition
│   │   └── feedback/
│   │       └── route.ts              # Feedback submission endpoint
│   ├── layout.tsx                    # Root layout with metadata
│   └── page.tsx                      # Main chat interface
├── components/
│   └── feedback-buttons.tsx          # Feedback UI with comment modal
└── instrumentation.ts                # TCC OpenTelemetry setup
```

### Key Implementation Details

#### TCC Instrumentation

Located in `src/instrumentation.ts`:

```typescript
import { registerOTelTCC } from "@contextcompany/otel/nextjs";

export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") registerOTelTCC({ debug: true });
}
```

#### Weather Agent

The weather agent is defined inline in `src/app/api/chat/route.ts` and demonstrates:

- Simple tool definitions with minimal schemas
- Mock data for 5 cities (San Francisco, New York, London, Tokyo, Sydney)
- Ultra-minimal system prompt (1 sentence)
- Multi-step execution with `maxSteps: 5`
- Standard AI SDK pattern with everything in one place

#### Chat Endpoint

`src/app/api/chat/route.ts` handles:

- Request body parsing
- Session and run ID generation
- Agent initialization with multi-step support
- TCC metadata attachment

#### Feedback Flow

1. User clicks thumbs up/down or comment button
2. Frontend sends feedback with runId to `/api/feedback`
3. Backend validates and submits to TCC via `submitFeedback()`
4. TCC links feedback to the specific AI interaction

## TCC Dashboard

After running the application and generating some conversations:

1. Visit your TCC dashboard
2. Navigate to Traces to see all AI interactions
3. View tool calls, latency, and token usage
4. Check Feedback section to see user ratings and comments
5. Observe multi-step execution patterns

## Development

### Understanding Multi-Step Execution

The agent uses `maxSteps: 5` to enable multi-step workflows. For example:

**User:** "Pick a random city and tell me the weather"

1. **Step 1**: Agent calls `getLocation()` → returns "London"
2. **Step 2**: Agent calls `getWeather("London")` → returns weather data
3. **Step 3**: Agent generates response with the weather information

Without `maxSteps`, the agent would stop after the first tool call.

### Customizing the Agent

To modify the weather locations, edit the constants at the top of `src/app/api/chat/route.ts`:

```typescript
const locations = ["Your", "Custom", "Cities"];

const mockWeather: Record<string, any> = {
  Your: { temp: 70, condition: "Sunny", humidity: 50 },
  // Add more cities...
};
```

## Troubleshooting

**Issue:** No traces appearing in TCC dashboard

- Verify `instrumentation.ts` is in `src/` directory
- Check environment variables are set correctly
- Ensure `experimental_telemetry.isEnabled` is `true`
- Look for errors in server console

**Issue:** Feedback not submitting

- Verify runId is being passed correctly from chat route
- Check network tab for API errors
- Confirm TCC_FEEDBACK_URL is correct

**Issue:** Agent stops after one tool call

- Verify `maxSteps: 5` is set in the agent configuration
- Check server logs for errors

## Learn More

- [Vercel AI SDK Documentation](https://sdk.vercel.ai/docs)
- [The Context Company Documentation](https://docs.thecontext.company)
- [Next.js App Router](https://nextjs.org/docs/app)
- [OpenTelemetry](https://opentelemetry.io/)

## License

MIT

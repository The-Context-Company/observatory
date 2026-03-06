# LangChain / LangGraph TypeScript Example with TCC Instrumentation

A LangGraph agent with tool calling, automatically traced by The Context Company. Demonstrates multi-turn conversational sessions with `sessionId` and `conversational` tracking.

## Features

- **LangGraph agent** with weather, attractions, and flight tools
- **Conversational sessions** — multiple turns grouped under a single `sessionId`
- **Runs, steps, and tool calls** are captured and sent to TCC

## Setup

1. **Install dependencies**:
   ```bash
   pnpm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   ```
   Add your OpenAI and TCC API keys to `.env`.

3. **Run the example**:
   ```bash
   pnpm dev
   ```

## How it works

The example runs a 3-turn conversation where the user asks about a trip from New York to Tokyo. Each turn creates a `TCCCallbackHandler` with the same `sessionId` and `conversational: true`, so TCC groups all runs into a single thread:

```typescript
import { TCCCallbackHandler } from "@contextcompany/langchain";

const sessionId = crypto.randomUUID();

// Each turn uses the same sessionId — TCC links them as a conversation
const handler = new TCCCallbackHandler({
  sessionId,
  conversational: true,
  metadata: { agent: "travel-planner" },
});

await graph.invoke(
  { messages: conversationHistory },
  { callbacks: [handler] }
);
```

The handler automatically captures per turn:
- **Runs** — the full graph invocation (prompt, response, duration, status)
- **Steps** — each LLM call (model, tokens, latency, TTFT)
- **Tool calls** — each tool execution (name, args, result, duration)

### Config options

| Option | Description |
|--------|-------------|
| `sessionId` | Groups multiple runs into a single session/conversation in TCC |
| `conversational` | Marks the run as part of a multi-turn thread (`true` / `false`) |
| `runId` | Explicit run ID (auto-generated if omitted) |
| `metadata` | Arbitrary key-value pairs attached to every run |
| `debug` | Enables verbose console logging |

### Global handler vs per-invocation

For simple scripts, you can use `setGlobalHandler` to trace everything automatically:

```typescript
import { TCCCallbackHandler, setGlobalHandler } from "@contextcompany/langchain";

setGlobalHandler(new TCCCallbackHandler());
```

For conversational flows or server environments where each request needs its own `sessionId`, create a handler per invocation and pass it via `callbacks`.

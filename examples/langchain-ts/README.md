# LangChain / LangGraph TypeScript Example with TCC Instrumentation

A LangGraph agent with tool calling, automatically traced by The Context Company. Works with any LangChain.js or LangGraph application.

## Features

- **LangGraph agent** with weather, attractions, and flight tools
- **One-line TCC setup** via `setGlobalHandler()` — all calls are traced automatically
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

```typescript
import { TCCCallbackHandler, setGlobalHandler } from "@contextcompany/langchain";

// One line — every LangChain/LangGraph call is now traced.
setGlobalHandler(new TCCCallbackHandler());
```

The handler automatically captures:
- **Runs** — the full graph/chain invocation (prompt, response, duration, status)
- **Steps** — each LLM call (model, tokens, latency, TTFT)
- **Tool calls** — each tool execution (name, args, result, duration)

Everything is batched and sent to TCC when the invocation completes.

## Per-invocation config

If you need different `runId` / `sessionId` per request (e.g. in a server), pass the handler directly instead of using the global hook:

```typescript
const handler = new TCCCallbackHandler({
  runId: "my-run-id",
  sessionId: "my-session-id",
  metadata: { userId: "user-123" },
});

await graph.invoke(
  { messages: [{ role: "user", content: "Hello" }] },
  { callbacks: [handler] }
);
```

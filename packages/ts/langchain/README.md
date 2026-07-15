# @contextcompany/langchain

Observability for LangChain.js and LangGraph applications. The callback handler captures top-level runs, model steps, tool calls, errors, token usage, latency, sessions, and custom metadata.

## Install

```bash
pnpm add @contextcompany/langchain @langchain/core
```

Set your API key before starting the application:

```bash
TCC_API_KEY=your_api_key
```

## Setup

Register a global handler once during application startup:

```ts
import {
  setGlobalHandler,
  TCCCallbackHandler,
} from "@contextcompany/langchain";

setGlobalHandler(
  new TCCCallbackHandler({
    metadata: {
      agent: "support-agent",
      environment: "production",
    },
  })
);
```

You can also attach a handler to one invocation:

```ts
import { TCCCallbackHandler } from "@contextcompany/langchain";

const result = await graph.invoke(
  { messages },
  {
    callbacks: [
      new TCCCallbackHandler({
        runId: crypto.randomUUID(),
        sessionId: "session-123",
        conversational: true,
      }),
    ],
  }
);
```

## Per-invocation metadata

With a global handler, pass TCC overrides through LangChain's `metadata.tcc` field. Other metadata keys are attached to the run as custom metadata.

```ts
await graph.invoke(
  { messages },
  {
    metadata: {
      tcc: {
        runId: crypto.randomUUID(),
        sessionId: "session-123",
        conversational: true,
      },
      environment: "production",
      userId: "user-123",
    },
  }
);
```

Call `clearGlobalHandler()` if the process needs to remove the registered handler.

See the complete [LangChain and LangGraph integration guide](https://docs.thecontextcompany.com/frameworks/langchain-langgraph).

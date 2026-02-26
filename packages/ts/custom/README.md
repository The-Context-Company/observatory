# @contextcompany/custom

Manual instrumentation SDK for AI runs. Use this when you have custom agents, in-house frameworks, or stacks that don't use AI SDK, Mastra, or OpenTelemetry.

## Install

```bash
pnpm add @contextcompany/custom
```

## Quick Start

```ts
import { run, setDebug } from "@contextcompany/custom";

// Optional: enable debug logs
setDebug(true); // or set TCC_DEBUG=1

const r = run({ sessionId: "sess-123", conversational: true });
const userMessage = "What's the weather in SF?";
r.prompt(userMessage);
r.metadata({ agent: "router", model: "gpt-4o" });

try {
  const response = await callLLM(userMessage);
  r.response(response);
  r.end();
} catch (e) {
  r.error(String(e));
}
```

## API

### Run

A **run** is one AI invocation (one agent turn, one conversation turn).

```ts
import { run } from "@contextcompany/custom";

const r = run({ runId?: string; sessionId?: string; conversational?: boolean });

// Required before .end()
r.prompt("user message");

// Optional
r.response("model response");
r.metadata({ key: "value" });
r.status(0, "optional message");

// Finalize (sends to TCC)
r.end();   // success
r.error("error message");  // failure

// Create child spans
r.step();      // → Step
r.toolCall();  // → ToolCall
```

### Step

A **step** is one LLM call within a run. Create via `run.step()`.

```ts
const s = r.step();  // or step(runId, stepId?)

s.prompt(JSON.stringify(messages));
s.response(assistantContent);
s.model({ requested: "gpt-4o", used: "gpt-4o" });
s.tokens({ promptUncached: 100, completion: 50 });
s.toolDefinitions(JSON.stringify(tools));
s.end();  // or s.error("msg")
```

### ToolCall

A **tool call** is one tool execution within a run. Create via `run.toolCall()`.

```ts
// Builder pattern (dot notation)
const tc = r.toolCall();  // or toolCall(runId, toolCallId?)
tc.name("search");
tc.args({ query: "SF weather" });
tc.result(JSON.stringify(results));
tc.end();  // or tc.error("msg")

// Pass all data at once
r.toolCall({ name: "search", args: { query: "SF weather" }, result: results }).end();
// or use .set() for partial updates
tc.set({ name: "search", args: { query: "SF weather" }, result: results });
tc.end();
```

### Feedback

```ts
import { submitFeedback } from "@contextcompany/custom";

await submitFeedback({ runId: "...", score: "thumbs_up" });
```

## Environment

| Variable     | Description                                      |
| ------------ | ------------------------------------------------- |
| `TCC_API_KEY` | Required. Your Context Company API key.          |
| `TCC_DEBUG`   | Set to `1` or `true` for debug logs.            |

## Debug

```ts
import { setDebug } from "@contextcompany/custom";

setDebug(true);  // enables debug logs (same effect as TCC_DEBUG=1)
```

## Design

- **Builder pattern**: Chain methods, call `.end()` or `.error()` to send.
- **Fire-and-forget**: Payloads are sent asynchronously; failures are logged to console.
- **Validation**: `.end()` throws if required fields (e.g. `prompt`) are missing.

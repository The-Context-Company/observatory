# @contextcompany/custom

Manual instrumentation SDK for AI agent observability. Use this when you have
custom agents, in-house frameworks, or stacks that aren't covered by our
automatic integrations (AI SDK, Mastra, etc.).

## Install

```bash
npm add @contextcompany/custom
```

## Setup

Set your API key as an environment variable:

```bash
TCC_API_KEY=your_api_key
```

Or configure programmatically:

```ts
import { configure } from "@contextcompany/custom";

configure({ apiKey: "your_api_key" });
```

## Usage

The SDK supports two patterns depending on your use case.

### Builder pattern — instrument as you go

Use this when you're wrapping live agent execution and recording events as they
happen. Steps and tool calls are batched with the run and sent in a single
request when you call `run.end()`.

```ts
import { run } from "@contextcompany/custom";

const r = run({ sessionId: "session-abc", conversational: true });
r.prompt("What's the weather in San Francisco?");

// Record an LLM step
const s = r.step();
s.prompt(JSON.stringify(messages));
s.response(assistantContent);
s.model("gpt-4o");
s.tokens({ uncached: 120, cached: 30, completion: 45 });
s.end();

// Record a tool call
const tc = r.toolCall("get_weather");
tc.args({ city: "San Francisco" });
tc.result({ temp: 72, unit: "F" });
tc.end();

// Finish the run — sends everything in one batch
r.response("It's 72°F in San Francisco.");
await r.end();
```

Error handling:

```ts
try {
  const result = await agent.run(userMessage);
  r.response(result);
  await r.end();
} catch (e) {
  // Auto-ends any un-ended children with error status
  await r.error(String(e));
}
```

### Factory pattern — send pre-built data

Use this when all data is already available (post-hoc logging, batch imports,
replaying from logs).

```ts
import { sendRun } from "@contextcompany/custom";

await sendRun({
  prompt: "What's the weather?",
  response: "72°F in San Francisco",
  startTime: new Date("2025-01-01T00:00:00Z"),
  endTime: new Date("2025-01-01T00:00:01Z"),
  metadata: { agent: "weather-bot" },
  steps: [
    {
      prompt: JSON.stringify(messages),
      response: assistantContent,
      model: "gpt-4o",
      tokens: { uncached: 120, completion: 45 },
      startTime: new Date("2025-01-01T00:00:00Z"),
      endTime: new Date("2025-01-01T00:00:01Z"),
    },
  ],
  toolCalls: [
    {
      name: "get_weather",
      args: { city: "San Francisco" },
      result: { temp: 72, unit: "F" },
      startTime: new Date("2025-01-01T00:00:00Z"),
      endTime: new Date("2025-01-01T00:00:01Z"),
    },
  ],
});
```

You can also send steps and tool calls independently:

```ts
import { sendStep, sendToolCall } from "@contextcompany/custom";

await sendStep({
  runId: "run_abc",
  prompt: JSON.stringify(messages),
  response: assistantContent,
  model: { requested: "gpt-4o", used: "gpt-4o-2024-08-06" },
  tokens: { uncached: 120, cached: 30, completion: 45 },
  cost: 0.0042,
  startTime: new Date(),
  endTime: new Date(),
});

await sendToolCall({
  runId: "run_abc",
  name: "search",
  args: { query: "SF weather" },
  result: { temp: 72 },
  startTime: new Date(),
  endTime: new Date(),
});
```

## API reference

### `run(options?)`

Create a new run builder.

| Option           | Type      | Default              |
| ---------------- | --------- | -------------------- |
| `runId`          | `string`  | auto-generated UUID  |
| `sessionId`      | `string`  | —                    |
| `conversational` | `boolean` | —                    |
| `startTime`      | `Date`    | `new Date()`         |
| `timeout`        | `number`  | `1200000` (20 min)   |

**Run methods:**

| Method                       | Description                                           |
| ---------------------------- | ----------------------------------------------------- |
| `.prompt(text)`              | Set the user prompt (required before `.end()`)        |
| `.response(text)`            | Set the agent response                                |
| `.metadata({ key: "val" })` | Attach metadata key-value pairs                       |
| `.status(code, message?)`   | Set status (0 = success, 2 = error)                   |
| `.endTime(date)`             | Set a custom end time                                 |
| `.step(idOrOptions?)`        | Create an attached Step                               |
| `.toolCall(nameOrOptions?)`  | Create an attached ToolCall                           |
| `.end()`                     | Finalize and send (returns `Promise<void>`)           |
| `.error(message?)`           | End with error status and send (returns `Promise<void>`) |

### `Step` (via `run.step()`)

| Method                        | Description                                        |
| ----------------------------- | -------------------------------------------------- |
| `.prompt(text)`               | Set the LLM prompt (required)                      |
| `.response(text)`             | Set the LLM response (required)                    |
| `.model("gpt-4o")`           | Set model name (shorthand)                         |
| `.model({ requested, used })` | Set model with requested/used distinction          |
| `.tokens({ uncached, cached, completion })` | Set token counts                    |
| `.cost(amount)`               | Set the actual cost in USD                         |
| `.finishReason(reason)`       | Set the finish reason                              |
| `.toolDefinitions(defs)`      | Set tool definitions (string or array)             |
| `.status(code, message?)`    | Set status code                                    |
| `.endTime(date)`              | Set a custom end time                              |
| `.end()`                      | Mark step as complete                              |
| `.error(message?)`            | Mark step as errored                               |

### `ToolCall` (via `run.toolCall()`)

| Method                     | Description                                     |
| -------------------------- | ----------------------------------------------- |
| `.name(toolName)`          | Set the tool name (required)                    |
| `.args(value)`             | Set args (string or object, auto-serialized)    |
| `.result(value)`           | Set result (string or object, auto-serialized)  |
| `.status(code, message?)`  | Set status code                                 |
| `.endTime(date)`           | Set a custom end time                           |
| `.end()`                   | Mark tool call as complete                      |
| `.error(message?)`         | Mark tool call as errored                       |

### Factory functions

| Function                     | Description                                        |
| ---------------------------- | -------------------------------------------------- |
| `sendRun(input)`             | Send a complete run with optional nested steps/toolCalls |
| `sendStep(input)`            | Send a single step (requires `runId`)              |
| `sendToolCall(input)`        | Send a single tool call (requires `runId`)         |

### Configuration

```ts
import { configure } from "@contextcompany/custom";

configure({
  apiKey: "your_api_key",  // overrides TCC_API_KEY env var
  debug: true,             // overrides TCC_DEBUG env var
});
```

### Feedback

```ts
import { submitFeedback } from "@contextcompany/custom";

await submitFeedback({ runId: "...", score: "thumbs_up" });
```

## Environment variables

| Variable    | Description                            |
| ----------- | -------------------------------------- |
| `TCC_API_KEY` | API key (or use `configure()`)       |
| `TCC_URL`     | Custom ingestion URL override        |
| `TCC_DEBUG`   | Set to `1` or `true` for debug logs  |

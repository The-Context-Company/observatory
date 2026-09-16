# @contextcompany/claude

Claude Agent SDK instrumentation for The Context Company.

Verified with `@anthropic-ai/claude-agent-sdk@0.3.273`. Requires Node 18 or newer; Node 22 is recommended for onboarding. The latest Claude SDK uses Zod 4.

```bash
npm install @contextcompany/claude @anthropic-ai/claude-agent-sdk@0.3.273 @anthropic-ai/sdk@^0.93.0 zod@^4
```

Set `ANTHROPIC_API_KEY` and `TCC_API_KEY`, then wrap the SDK once:

```typescript
import * as claude from "@anthropic-ai/claude-agent-sdk";
import { instrumentClaudeAgent } from "@contextcompany/claude";

const { query } = instrumentClaudeAgent(claude);
const response = query({
  prompt: "What is 2 + 2?",
  options: { model: "haiku" },
  tcc: {
    conversational: true,
    metadata: { userId: "user-123" },
  },
});

for await (const message of response) {
  if (message.type === "result" && message.subtype === "success") {
    console.log(message.result);
  }
}
```

The returned query preserves SDK controls including `interrupt()`, `setModel()`, and `close()`. String and streaming prompts are supported. Telemetry preserves the SDK messages and attaches run/session IDs. Stream completion, errors, and early iterator return send collected telemetry. Delivery is best effort, with a 10-second request timeout; telemetry failures do not fail the agent.

Normal iteration waits for telemetry before finishing. If using synchronous `response.close()`, call `await flushClaudeTelemetry()` before process shutdown:

```typescript
import { flushClaudeTelemetry } from "@contextcompany/claude";
response.close();
await flushClaudeTelemetry();
```

A query with streaming input is recorded as one run covering all its turns. Use separate queries with a shared `tcc.sessionId` for separate runs.

For a local ingestion server, set `TCC_BASE_URL=http://localhost:8787`. Otherwise the endpoint is selected from the TCC API key.

[Full documentation](https://docs.thecontextcompany.com/frameworks/claude-agent-sdk)

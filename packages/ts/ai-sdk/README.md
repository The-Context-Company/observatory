# `@contextcompany/ai-sdk`

The Context Company observability integration for Vercel AI SDK 7.

```bash
pnpm add @contextcompany/ai-sdk ai @opentelemetry/api
```

For Next.js, register the integration from `instrumentation.ts`:

```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerTCC } = await import("@contextcompany/ai-sdk/nextjs");
    registerTCC();
  }
}
```

Add TCC metadata to each AI SDK call:

```ts
import { tccTelemetry } from "@contextcompany/ai-sdk";
import { streamText } from "ai";

const runId = crypto.randomUUID();
const result = streamText({
  model,
  prompt: "Hello",
  ...tccTelemetry({ runId, agent: "support-agent" }),
});
```

Set `TCC_API_KEY` before starting your application. See the full guide at https://docs.thecontext.company/frameworks/vercel-ai-sdk.

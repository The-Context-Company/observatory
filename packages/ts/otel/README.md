# @contextcompany/otel

OpenTelemetry integration for AI SDK calls across multiple runtime shapes.

This package currently provides:

- `@contextcompany/otel/nextjs` for the existing Node/Next.js OTEL registration path
- `@contextcompany/otel/runtime` for web-standard server runtimes that cannot rely on the Node/Next.js setup

## Install

For the base package:

```bash
pnpm add @contextcompany/otel @opentelemetry/api
```

If you are using the Next.js helper, also install:

```bash
pnpm add @vercel/otel
```

## Next.js

Use `@contextcompany/otel/nextjs` when you want the existing Next.js
instrumentation flow:

```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerOTelTCC } = await import("@contextcompany/otel/nextjs");
    registerOTelTCC();
  }
}
```

## Runtime Helper

Use `@contextcompany/otel/runtime` in web-standard server runtimes such as
Cloudflare Workers and Durable Objects.

It creates a custom tracer for AI SDK v6 calls and converts completed `ai.*`
spans into The Context Company's run/step/tool_call payload format.

```ts
import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import { createTCCAISDKTelemetry } from "@contextcompany/otel/runtime";

const tcc = createTCCAISDKTelemetry({
  apiKey: env.TCC_API_KEY,
  metadata: {
    deployment: "workers",
  },
});

const result = streamText(
  tcc.instrument({
    model: openai("gpt-4o-mini"),
    prompt: "Write a haiku about the edge.",
    experimental_telemetry: {
      metadata: {
        "tcc.runId": crypto.randomUUID(),
        "tcc.sessionId": "session-123",
        "tcc.conversational": true,
      },
    },
  })
);
```

`instrument()` injects the tracer into `experimental_telemetry` and flushes
pending exports in AI SDK's `onFinish` hook.

If you want more control, use `telemetry()` directly and call `flush()`
yourself.

## Reserved Metadata Keys

The runtime helper recognizes these telemetry metadata keys and maps them into
run fields automatically:

- `tcc.runId`
- `tcc.run_id`
- `tcc.sessionId`
- `tcc.session_id`
- `tcc.conversational`

All other telemetry metadata is forwarded as custom run metadata.
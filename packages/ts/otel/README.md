# @contextcompany/otel

This package contains The Context Company's OpenTelemetry integration for Node and Next.js environments.

## Vercel AI SDK compatibility

`@contextcompany/otel` does not depend on the `ai` package, so it can be installed alongside AI SDK 5, 6, or 7.

- AI SDK 5 and 6 emit legacy `ai.*` OpenTelemetry spans through `experimental_telemetry`. These remain supported.
- AI SDK 7 uses the stable `telemetry` option and the separate `@ai-sdk/otel` package. Native `gen_ai` spans are supported.

For AI SDK 7, register both integrations during application startup:

```ts
import { OpenTelemetry } from "@ai-sdk/otel";
import { registerTelemetry } from "ai";
import { registerOTelTCC } from "@contextcompany/otel/nextjs";

registerOTelTCC();
registerTelemetry(new OpenTelemetry({ runtimeContext: true }));
```

Pass TCC metadata as runtime context and explicitly include it in telemetry:

```ts
streamText({
  model,
  prompt,
  runtimeContext: {
    "tcc.runId": runId,
    "tcc.sessionId": sessionId,
  },
  telemetry: {
    includeRuntimeContext: {
      "tcc.runId": true,
      "tcc.sessionId": true,
    },
  },
});
```

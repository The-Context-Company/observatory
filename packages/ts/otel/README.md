# @contextcompany/otel

This package contains The Context Company's OpenTelemetry integration for AI SDK applications.

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

Use `@contextcompany/otel/nextjs` to wire TCC into Next.js with `@vercel/otel`.

```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerOTelTCC } = await import("@contextcompany/otel/nextjs");
    registerOTelTCC();
  }
}
```

## Cloudflare Workers

Use `@contextcompany/otel/workers` when you need to manually register TCC tracing in
Cloudflare Workers or Durable Objects.

Cloudflare must have `nodejs_als` or `nodejs_compat` enabled so
`AsyncLocalStorageContextManager` can propagate context correctly.

```ts
import {
  registerOTelTCC,
  getTCCTracer,
  scheduleTCCFlush,
} from "@contextcompany/otel/workers";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    registerOTelTCC(env);

    try {
      return await handleRequest(request, {
        tracer: getTCCTracer(env),
      });
    } finally {
      scheduleTCCFlush(ctx);
    }
  },
} satisfies ExportedHandler<Env>;
```

`registerOTelTCC()` is safe to call more than once and becomes a no-op when
`TCC_API_KEY` is not set.

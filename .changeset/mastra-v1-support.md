---
"@contextcompany/mastra": major
---

Support Mastra 1.x. `TCCMastraExporter` now implements the `ObservabilityExporter` interface from `@mastra/core/observability` (replacing the removed `@mastra/core/ai-tracing` module) and adds `flush()`, which waits for in-flight export requests, for serverless environments. Traces are dequeued before export so `flush()`/`shutdown()` can no longer send a trace twice while its request is in flight. The `@mastra/core` peer dependency is now `>=1.0.0 <2.0.0`; Mastra 0.x is no longer supported.

Mastra 1.x requires wrapping observability config in `new Observability({...})` from `@mastra/observability`:

```ts
import { Observability } from "@mastra/observability";
import { TCCMastraExporter } from "@contextcompany/mastra";

new Mastra({
  observability: new Observability({
    configs: {
      default: {
        serviceName: "my-agent",
        exporters: [new TCCMastraExporter({})],
      },
    },
  }),
});
```

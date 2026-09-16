# @contextcompany/mastra

## 2.0.0

### Major Changes

- 64d68c6: Support Mastra 1.x. `TCCMastraExporter` now implements the `ObservabilityExporter` interface from `@mastra/core/observability` (replacing the removed `@mastra/core/ai-tracing` module) and adds `flush()`, which waits for in-flight export requests, for serverless environments. Traces are dequeued before export so `flush()`/`shutdown()` can no longer send a trace twice while its request is in flight. The `@mastra/core` peer dependency is now `>=1.0.0 <2.0.0`; Mastra 0.x is no longer supported.

  Mastra 1.x requires wrapping observability config in `new Observability({...})` from `@mastra/observability`:

  ```ts
  import { TCCMastraExporter } from "@contextcompany/mastra";
  import { Observability } from "@mastra/observability";

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

## 1.0.3

### Patch Changes

- 3766d09: Update published package homepage and documentation links to the current The Context Company domains.

## 1.0.2

### Patch Changes

- 5c0068f: Harden feedback submission by validating run IDs before sending feedback and restricting configurable TCC API endpoints to official origins or localhost by default.

## 1.0.1

### Patch Changes

- 6c6bc9c: bundle @contextcompany/api at build time to fix endpoint resolution

---
"@contextcompany/otel": patch
---

Prevent span export loss on serverless runtimes and surface export failures. Span export requests are now registered with the Vercel request context's `waitUntil` (no-op elsewhere), so the function instance is kept alive until telemetry delivery completes instead of freezing the moment the response closes and killing the export mid-flight. The OTLP exporter now treats non-2xx ingest responses as export errors instead of silent successes, and run batch export failures are logged.

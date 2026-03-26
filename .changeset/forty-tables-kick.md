---
"@contextcompany/otel": patch
---

Add a new `@contextcompany/otel/workers` helper for Cloudflare Workers and
Durable Objects. It registers TCC tracing with a Workers-compatible tracer
provider, installs async context propagation, and exposes helpers to get a
tracer and flush spans with `waitUntil()`.

This also removes the short-lived `@contextcompany/otel/runtime` helper
introduced in `1.0.14`.

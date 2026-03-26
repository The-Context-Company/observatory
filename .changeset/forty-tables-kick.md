---
"@contextcompany/otel": patch
---

Add a new `@contextcompany/otel/runtime` helper for AI SDK v6 in worker-style
web-standard runtimes. It uses a custom tracer instead of the Node/Next.js
OTEL pipeline and converts finished AI SDK spans into The Context Company's
run/step/tool_call payloads.

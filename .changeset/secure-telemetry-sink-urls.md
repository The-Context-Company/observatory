---
"@contextcompany/api": patch
"@contextcompany/custom": patch
"@contextcompany/otel": patch
"@contextcompany/claude": patch
"@contextcompany/pi": patch
"@contextcompany/mastra": patch
"@contextcompany/langchain": patch
"@contextcompany/openclaw": patch
---

fix: refuse to send the API key or telemetry to non-TCC endpoints (TC-006)

Adds a shared `assertSafeTCCUrl` guard in `@contextcompany/api` and enforces it
at every network sink that attaches `Authorization: Bearer <TCC_API_KEY>` (OTLP
trace exporter, custom/claude/pi/mastra/langchain/openclaw transports). The
guard rejects any origin that isn't TCC-controlled (prod/dev/localhost) unless
`TCC_ALLOW_UNSAFE_BASE_URL=1` is set, so a hijacked `TCC_BASE_URL` or an
explicit endpoint override can no longer exfiltrate the API key or trace data.

---
"@contextcompany/api": patch
"@contextcompany/custom": patch
"@contextcompany/otel": patch
"@contextcompany/claude": patch
"@contextcompany/mastra": patch
"@contextcompany/langchain": patch
"@contextcompany/openclaw": patch
"@contextcompany/pi": patch
---

Harden feedback submission by validating run IDs before sending feedback and restricting configurable TCC API endpoints to official origins or localhost by default.

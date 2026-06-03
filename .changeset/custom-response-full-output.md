---
"@contextcompany/custom": minor
---

Add optional `full_output` on run responses.

Pass `full_output` alongside `response` to store the raw/full model output (e.g. the final assistant message including tool_use blocks, or a reply delivered via a tool call) verbatim for replay and debugging, while `response` continues to drive dashboard preview and search. Supported on `run().response()` and `RunInput.response`.

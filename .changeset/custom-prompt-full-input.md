---
"@contextcompany/custom": minor
---

Add optional `full_input` on run prompts.

Pass `full_input` alongside `user_prompt` (and optional `system_prompt`) to store the raw provider request body or message history verbatim for replay and debugging, while `user_prompt` continues to drive dashboard preview and search. Supported on `run().prompt()` and `RunInput.prompt`.

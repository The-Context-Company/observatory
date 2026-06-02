# @contextcompany/custom

## 1.1.0

### Minor Changes

- 54d9964: Add optional `full_input` on run prompts.

  Pass `full_input` alongside `user_prompt` (and optional `system_prompt`) to store the raw provider request body or message history verbatim for replay and debugging, while `user_prompt` continues to drive dashboard preview and search. Supported on `run().prompt()` and `RunInput.prompt`.

## 1.0.2

### Patch Changes

- 6c6bc9c: bundle @contextcompany/api at build time to fix endpoint resolution

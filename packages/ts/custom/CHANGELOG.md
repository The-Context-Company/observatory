# @contextcompany/custom

## 1.2.2

### Patch Changes

- 3766d09: Update published package homepage and documentation links to the current The Context Company domains.

## 1.2.1

### Patch Changes

- 5c0068f: Redact secrets from custom TypeScript status messages before sending runs, steps, tool calls, and direct event payloads.
- 5c0068f: Harden feedback submission by validating run IDs before sending feedback and restricting configurable TCC API endpoints to official origins or localhost by default.

## 1.2.0

### Minor Changes

- bf2e797: Add optional `full_output` on run responses.

  Pass `full_output` alongside `response` to store the raw/full model output (e.g. the final assistant message including tool_use blocks, or a reply delivered via a tool call) verbatim for replay and debugging, while `response` continues to drive dashboard preview and search. Supported on `run().response()` and `RunInput.response`.

### Patch Changes

- bf2e797: Fix stale `full_output` on `run().response()`. Calling `.response()` with a string after a prior call set `full_output` now clears the previous value, so the run payload no longer carries replay/debug output that doesn't match the visible reply.

## 1.1.0

### Minor Changes

- 54d9964: Add optional `full_input` on run prompts.

  Pass `full_input` alongside `user_prompt` (and optional `system_prompt`) to store the raw provider request body or message history verbatim for replay and debugging, while `user_prompt` continues to drive dashboard preview and search. Supported on `run().prompt()` and `RunInput.prompt`.

## 1.0.2

### Patch Changes

- 6c6bc9c: bundle @contextcompany/api at build time to fix endpoint resolution

---
"@contextcompany/custom": patch
---

Fix stale `full_output` on `run().response()`. Calling `.response()` with a string after a prior call set `full_output` now clears the previous value, so the run payload no longer carries replay/debug output that doesn't match the visible reply.

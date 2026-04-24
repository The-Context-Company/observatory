---
"@contextcompany/openclaw": patch
---

Share per-turn run IDs across multiple plugin instances in the same process.

Registering the plugin more than once in a single process (e.g. via `openclaw.json` plus a custom extension calling `register()`) caused each instance to mint its own runId for the same turn, producing duplicate rows on the server. Instances now converge on a shared runId per `sessionKey`, released on `agent_end` with a 30-minute TTL.

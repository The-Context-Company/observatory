---
"@contextcompany/claude": minor
---

Add `conversational` flag to `TCCConfig` to mark a run as user-initiated.

When set, the value is forwarded as the reserved `tcc.conversational` metadata key on the wire, matching the contract used by other TCC integrations. Existing callers are unaffected; the field is optional.

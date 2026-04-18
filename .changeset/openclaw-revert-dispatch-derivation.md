---
"@contextcompany/openclaw": patch
---

Fix: stop auto-deriving `sessionId` from `before_dispatch`. The composite `<accountId>:<channelId>:<conversationId>` was channel-scoped for Slack (OpenClaw's `deriveConversationId` strips thread info off Slack peers), which would have collapsed all threads in a channel into one TCC session.

Fall back directly to `ctx.sessionKey`, which OpenClaw already scopes per thread for channel integrations with threads enabled (verified against live third-eye data: threads in the same Slack channel get distinct sessionKeys).

Net effect on 1.1.0 → 1.1.1: run_id fix stays (unique per turn). session_id is now correctly thread-scoped for Slack instead of channel-scoped. User overrides via config `sessionId` or `onRunStart.setSessionId` behave the same.

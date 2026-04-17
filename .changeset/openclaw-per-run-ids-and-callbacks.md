---
"@contextcompany/openclaw": minor
---

Per-turn run IDs, per-thread sessions, and callback-based instrumentation.

**What changed**

- Plugin now hooks `before_agent_start` and mints a fresh UUID run ID for every agent turn. Per-session state is keyed by `sessionKey`, so concurrent sessions (e.g. multiple Slack threads) no longer clobber each other.
- New `onRunStart` and `onRunEnd` callbacks give you per-run access to the run ID, Slack/Discord/etc. thread context, and mutators: `setRunId`, `setSessionId`, `setMetadata`.
- `sessionId` and `metadata` config fields now accept either a static value or a function `(ctx) => value` so they can be derived from the agent context.
- New handle methods: `getRunIdForSession(sessionKey)` for concurrency-safe lookup, `setRunContext(sessionKey, { runId, sessionId, metadata })` for imperative overrides.
- Re-exports `submitFeedback` from `@contextcompany/api` so you can close the loop: capture the run ID in `onRunEnd`, submit feedback later.

**Payload shape change**

The plugin now sends `tcc.runId`, `tcc.sessionId`, and `tcc.conversational` inside `metadata`, matching the convention used by the Vercel AI SDK, LangChain, Agno, Mastra, and Claude Agent SDK integrations. The ingest converter accepts both the new and legacy shapes, so you can upgrade the package without coordinating with the server.

**Fixes**

- `run_id` is now unique per agent turn. Previously the converter fell back to OpenClaw's internal stable run identifier, which caused multiple turns in the same session to share a run ID.
- `session_id` is now thread-scoped for channel-based setups out of the box. The plugin listens on `before_dispatch` and auto-derives `sessionId` as `<accountId>:<channelId>:<conversationId>` whenever both are available (Slack threads, Discord threads, Telegram chats, iMessage conversations, etc.). Falls back to `ctx.sessionKey` for non-channel flows (CLI, cron, subagents). User overrides via config `sessionId` or `onRunStart`'s `setSessionId` always win.

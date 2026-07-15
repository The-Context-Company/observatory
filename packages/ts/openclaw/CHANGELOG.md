# @contextcompany/openclaw

## 1.1.4

### Patch Changes

- 3766d09: Update published package homepage and documentation links to the current The Context Company domains.

## 1.1.3

### Patch Changes

- 5c0068f: Harden feedback submission by validating run IDs before sending feedback and restricting configurable TCC API endpoints to official origins or localhost by default.

## 1.1.2

### Patch Changes

- 5830b93: Fix `openclaw plugins install @contextcompany/openclaw` failing with `Also not a valid hook pack: package.json missing openclaw.hooks`.

  The `openclaw.extensions` field in `package.json` pointed at `src/index.ts`, which Node can't load directly. openclaw fell back to its hook-pack loader, which then surfaced the misleading error. Repointed to the compiled output `dist/index.cjs` so the extension loads cleanly.

## 1.1.1

### Patch Changes

- 27f7570: Share per-turn run IDs across multiple plugin instances in the same process.

  Registering the plugin more than once in a single process (e.g. via `openclaw.json` plus a custom extension calling `register()`) caused each instance to mint its own runId for the same turn, producing duplicate rows on the server. Instances now converge on a shared runId per `sessionKey`, released on `agent_end` with a 30-minute TTL.

## 1.1.0

### Minor Changes

- f1dca2e: Per-turn run IDs, per-thread sessions, and callback-based instrumentation.

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

### Patch Changes

- 98b75fb: Fix: stop auto-deriving `sessionId` from `before_dispatch`. The composite `<accountId>:<channelId>:<conversationId>` was channel-scoped for Slack (OpenClaw's `deriveConversationId` strips thread info off Slack peers), which would have collapsed all threads in a channel into one TCC session.

  Fall back directly to `ctx.sessionKey`, which OpenClaw already scopes per thread for channel integrations with threads enabled (verified against live third-eye data: threads in the same Slack channel get distinct sessionKeys).

  Net effect on 1.1.0 → 1.1.1: run_id fix stays (unique per turn). session_id is now correctly thread-scoped for Slack instead of channel-scoped. User overrides via config `sessionId` or `onRunStart.setSessionId` behave the same.

## 1.0.2

### Patch Changes

- 6c6bc9c: bundle @contextcompany/api at build time to fix endpoint resolution

## 1.0.1

### Patch Changes

- 616f58b: Fix openclaw plugin packaging metadata: rename `openclaw.extension` to `openclaw.extensions` (plural array) and add `openclaw.plugin` pointer to manifest file

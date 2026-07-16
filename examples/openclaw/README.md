# OpenClaw + TCC Observability

Example showing how to add TCC instrumentation to an [OpenClaw](https://openclaw.ai) agent with per-run IDs, session grouping, and custom metadata.

## Option 1: Plugin Install (quickest)

```bash
openclaw plugins install @contextcompany/openclaw
```

Then add to your `~/.openclaw/openclaw.json`:

```json5
{
  "plugins": {
    "allow": ["openclaw"],
    "entries": {
      "openclaw": {
        "enabled": true,
        "hooks": {
          "allowConversationAccess": true
        },
        "config": {
          "apiKey": "${TCC_API_KEY}",
          "sessionId": "my-session-123",
          "metadata": {
            "environment": "development",
            "userId": "user_abc"
          }
        }
      }
    }
  }
}
```

OpenClaw requires `allowConversationAccess` before a non-bundled plugin can observe LLM input, output, and agent lifecycle events.

Restart the gateway:

```bash
openclaw gateway restart
```

Every agent turn will auto-mint a fresh UUID as its runId, tagged with the config's `sessionId` and `metadata`.

## Option 2: Custom Extension (recommended for real apps)

Use this when you need per-run control — e.g. a Slack bot where each thread is a session, each prompt needs its own UUID, and you want to capture the runId for feedback.

1. Copy [`extensions/tcc-observability/`](./extensions/tcc-observability/) into your OpenClaw extensions directory.

2. Set `TCC_API_KEY` in your environment.

3. Edit `extensions/tcc-observability/index.ts` — the `onRunStart` / `onRunEnd` callbacks run once per turn.

## Per-run API

```ts
import { register } from "@contextcompany/openclaw";

const handle = register(api, {
  // Layer 1 — static defaults (applied to every run as fallbacks)
  sessionId: (ctx) => ctx.sessionKey ?? "default",
  metadata:  (ctx) => ({ channel: ctx.channelId ?? "unknown" }),

  // Layer 2 — per-run overrides via callbacks (the main knob)
  onRunStart: ({ runId, ctx, prompt, setRunId, setSessionId, setMetadata }) => {
    // `runId` is an auto-minted UUID — keep it, or override:
    // setRunId(myUuid);

    setSessionId(`slack-${ctx.channelId}-${threadTs}`);
    setMetadata({
      slackUserId: extractUser(prompt),
      promptPreview: prompt.slice(0, 120),
    });
  },

  onRunEnd: ({ runId, ctx, success }) => {
    // Stash runId for feedback button
    lastRunByThread.set(ctx.sessionKey, runId);
    // Or submit feedback directly:
    //   import { submitFeedback } from "@contextcompany/otel";
    //   await submitFeedback({ runId, score: "thumbs_up" });
  },
});
```

### Layer 3 — imperative, outside callbacks

```ts
handle.setRunContext(sessionKey, {
  runId: crypto.randomUUID(),
  metadata: { foo: "bar" },
});
```

Precedence per run: **Layer 3 > Layer 2 > Layer 1 > auto-mint**. Metadata is shallow-merged; runId / sessionId are replaced.

### Concurrency-safe lookup

`handle.getRunId()` returns the last run globally — under concurrency, prefer:

```ts
handle.getRunIdForSession(sessionKey); // per-session, safe
```

## Important: UUID format for feedback

The TCC feedback and metadata HTTP endpoints validate `runId` against strict UUID v4 format. Auto-minted runIds are always valid. If you override via `setRunId`, use `crypto.randomUUID()` (or another UUID source) — non-UUID strings will be rejected by the feedback endpoint with 400.

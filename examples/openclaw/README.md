# OpenClaw + TCC Observability

Example showing how to add TCC instrumentation to an [OpenClaw](https://openclaw.ai) agent with run ID and metadata support.

## Option 1: Plugin Install (recommended)

```bash
openclaw plugins install @contextcompany/openclaw
```

Then add to your `~/.openclaw/openclaw.json`:

```json5
{
  "plugins": {
    "allow": ["@contextcompany/openclaw"],
    "entries": {
      "@contextcompany/openclaw": {
        "enabled": true,
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

Restart the gateway:

```bash
openclaw gateway restart
```

## Option 2: Custom Extension (with run ID access)

Use this approach when you need programmatic access to run IDs — e.g. to submit feedback after a run completes.

1. Copy `extensions/tcc-observability/` into your OpenClaw extensions directory.

2. Add `TCC_API_KEY` to your environment.

3. The extension registers the plugin and exposes the handle, which you can use to retrieve run IDs.

See [`extensions/tcc-observability/index.ts`](./extensions/tcc-observability/index.ts) for the full example.

## Run ID Flow

```
register(api, config)  →  handle
                              ├── handle.setRunId("custom-id")   // before a run
                              ├── handle.getRunId()              // after a run → use for feedback
                              └── handle.setMetadata({ ... })    // anytime
```

# @contextcompany/openclaw

The Context Company integration for [OpenClaw](https://open-claw.bot/) via OpenTelemetry.

This package provides a lightweight OTLP collector that receives traces from OpenClaw's built-in `diagnostics-otel` plugin, maps them to The Context Company's format, and forwards them to the TCC API for visualization and analysis.

## How It Works

```
┌──────────────┐   OTLP/JSON    ┌─────────────────────────┐   POST /v1/custom   ┌─────────┐
│   OpenClaw   │ ─────────────► │ @contextcompany/openclaw │ ──────────────────► │ TCC API │
│   Gateway    │   :4318        │  (collector server)       │                     │         │
└──────────────┘                └─────────────────────────┘                     └─────────┘
```

OpenClaw sends OTLP traces to the collector. The collector parses the spans, maps the OpenClaw span hierarchy (`openclaw.request` → agent turns → LLM calls → tool executions) to TCC's run/step/tool_call model, and sends the data to The Context Company's API.

## Quick Start

### 1. Install

```bash
npm install @contextcompany/openclaw
# or
pnpm add @contextcompany/openclaw
```

### 2. Set your API key

```bash
export TCC_API_KEY="your_api_key"
```

### 3. Start the collector

**CLI:**

```bash
npx @contextcompany/openclaw
```

**Programmatic:**

```typescript
import { createCollector } from "@contextcompany/openclaw";

const collector = createCollector({ port: 4318 });
await collector.start();
```

### 4. Configure OpenClaw

Add the following to your OpenClaw configuration (`~/.openclaw/openclaw.json`):

```json
{
  "diagnostics": {
    "otel": {
      "enabled": true,
      "endpoint": "http://localhost:4318",
      "protocol": "http/json",
      "traces": true,
      "captureContent": true
    }
  }
}
```

Or enable the diagnostics plugin via CLI:

```bash
openclaw plugins enable diagnostics-otel
```

> **Note:** Set `"protocol": "http/json"` — the collector currently supports JSON-encoded OTLP. Set `"captureContent": true` to capture LLM prompt and completion text for full observability.

## CLI Options

```
npx @contextcompany/openclaw [options]

Options:
  -p, --port <port>       Port to listen on (default: 4318)
      --host <host>       Host to bind to (default: 0.0.0.0)
      --api-key <key>     TCC API key (or set TCC_API_KEY env var)
      --endpoint <url>    Custom TCC endpoint URL
  -d, --debug             Enable debug logging
  -h, --help              Show help
```

## Programmatic API

```typescript
import { OpenClawCollector } from "@contextcompany/openclaw";

const collector = new OpenClawCollector({
  port: 4318,
  host: "0.0.0.0",
  apiKey: "tcc_abc123",  // or set TCC_API_KEY env var
  debug: true,
  flushTimeoutMs: 300_000,  // 5 min (default)
});

await collector.start();

// Later...
await collector.stop();
```

### Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `port` | `number` | `4318` | Port to listen on |
| `host` | `string` | `"0.0.0.0"` | Host to bind to |
| `apiKey` | `string` | `TCC_API_KEY` env | TCC API key |
| `endpoint` | `string` | Auto-detected | Custom TCC endpoint URL |
| `debug` | `boolean` | `false` | Enable debug logging |
| `flushTimeoutMs` | `number` | `300000` | Timeout for incomplete traces |

## Span Mapping

The collector maps OpenClaw's span hierarchy to TCC's data model:

| OpenClaw Span | TCC Type | Description |
|---------------|----------|-------------|
| `openclaw.request` | Run | Root request span |
| `chat <model>` | Step | LLM inference call |
| `tool.*` / `execute_tool *` | Tool Call | Tool execution |
| `openclaw.agent.turn` | — | Intermediate (not mapped directly) |

### Attributes

| OpenClaw Attribute | TCC Field |
|---|---|
| `openclaw.model` | `model_requested` / `model_used` |
| `openclaw.tokens.input` | `prompt_uncached_tokens` |
| `openclaw.tokens.output` | `completion_tokens` |
| `openclaw.tokens.cache_read` | `prompt_cached_tokens` |
| `openclaw.sessionId` | `session_id` |
| `gen_ai.prompt` | Step prompt (requires `captureContent`) |
| `gen_ai.completion` | Step response (requires `captureContent`) |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `TCC_API_KEY` | Your Context Company API key |
| `TCC_URL` | Custom TCC endpoint (overrides auto-detection) |

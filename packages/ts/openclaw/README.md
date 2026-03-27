# @contextcompany/openclaw

The Context Company observability plugin for [OpenClaw](https://openclaw.ai).

Captures LLM calls, tool executions, and agent lifecycle events from OpenClaw's plugin hook system, then exports them to The Context Company for visualization and analysis.

## Installation

```bash
npm install @contextcompany/openclaw
```

## Usage

Create an OpenClaw extension that registers the plugin:

```ts
// extensions/tcc-observability/index.ts
import { register } from "@contextcompany/openclaw";

export default async function (api) {
  register(api);
}
```

Set your API key via environment variable:

```bash
export TCC_API_KEY="your_api_key"
```

Or pass config directly:

```ts
register(api, {
  apiKey: "tcc_...",
  endpoint: "https://api.thecontext.company/v1/openclaw",
  debug: true,
});
```

## Configuration

| Option | Env Var | Default | Description |
|--------|---------|---------|-------------|
| `apiKey` | `TCC_API_KEY` | — | Your Context Company API key |
| `endpoint` | `TCC_URL` | Auto-detected from key | Ingestion endpoint URL |
| `debug` | `TCC_DEBUG` | `false` | Enable debug logging |

## How It Works

The plugin hooks into OpenClaw's agent lifecycle events:

| Hook | What it captures |
|------|-----------------|
| `llm_input` | LLM call start — model, prompt, system prompt, history |
| `llm_output` | LLM call end — response, token usage, cost |
| `before_tool_call` | Tool execution start — tool name, arguments |
| `after_tool_call` | Tool execution end — result, errors, duration |
| `agent_end` | Run complete — success/failure, full message history |

All events are collected during the agent run and sent as a single batch when the run completes.

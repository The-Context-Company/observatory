# @contextcompany/pi

The Context Company instrumentation for the [Pi Agent SDK](https://github.com/badlogic/pi-mono) (`@mariozechner/pi-coding-agent`).

Provides non-invasive telemetry collection for Pi agent sessions — simply call `instrumentPiSession()` and all agent runs, LLM calls, and tool executions are automatically captured and sent to The Context Company's API.

## Quick Start

### 1. Install

```bash
pnpm add @contextcompany/pi
# or
npm install @contextcompany/pi
```

### 2. Set your API key

```bash
export TCC_API_KEY="your_api_key"
```

### 3. Instrument your session

```typescript
import { createAgentSession } from '@mariozechner/pi-coding-agent';
import { instrumentPiSession } from '@contextcompany/pi';

const { session } = await createAgentSession();

// Add TCC instrumentation (non-invasive)
const unsub = instrumentPiSession(session, {
  sessionId: 'conversation-123',
  conversational: true,
});

// Use Pi as normal — telemetry is collected automatically
await session.prompt('What files are in the current directory?');

// To stop collecting telemetry:
unsub();
```

## How It Works

`instrumentPiSession()` calls `session.subscribe()` to listen for agent lifecycle events. It never modifies agent behavior — it only observes.

**Events captured:**

| Pi Event | TCC Type | Data |
|----------|----------|------|
| `agent_start` → `agent_end` | Run | Duration, user prompt, final response, status |
| `message_end` (assistant) | Step | Model, provider, token usage, cost, content, stop reason |
| `tool_execution_start` → `tool_execution_end` | Tool Call | Tool name, arguments, result, duration, error status |

**Rich data from Pi's `Usage` interface:**
- Input/output/cached token counts
- Per-request cost breakdown (input, output, cache read/write, total)
- Model and provider identification
- Stop reason (stop, length, toolUse, error, aborted)

## Configuration

```typescript
instrumentPiSession(session, {
  // TCC API key (or set TCC_API_KEY env var)
  apiKey: 'tcc_abc123',

  // Custom TCC endpoint URL
  endpoint: 'https://api.thecontext.company/v1/custom',

  // Session ID for grouping related runs
  sessionId: 'conversation-123',

  // Mark as conversational flow
  conversational: true,

  // Custom metadata attached to every run
  metadata: { agent: 'pi-coding-agent', version: '0.62.0' },

  // Enable debug logging
  debug: true,
});
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | `TCC_API_KEY` env | TCC API key |
| `endpoint` | `string` | Auto-detected | Custom TCC endpoint URL |
| `runId` | `string` | Auto-generated | Fixed run ID for all runs |
| `sessionId` | `string` | — | Group related runs together |
| `conversational` | `boolean` | — | Mark as conversational flow |
| `metadata` | `Record<string, unknown>` | — | Custom metadata per run |
| `debug` | `boolean` | `false` | Enable debug logging |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `TCC_API_KEY` | Your Context Company API key |
| `TCC_URL` | Custom TCC endpoint (overrides auto-detection) |

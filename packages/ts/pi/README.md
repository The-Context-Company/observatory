# @contextcompany/pi

Instrumentation for the [Pi Agent SDK](https://github.com/badlogic/pi-mono).

## Quick Start

### 1. Install

```bash
pnpm add @contextcompany/pi
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

instrumentPiSession(session, {
  sessionId: 'conversation-123',
  conversational: true,
});

await session.prompt('What files are in the current directory?');
```

## Configuration

```typescript
instrumentPiSession(session, {
  apiKey: 'tcc_abc123',
  sessionId: 'conversation-123',
  conversational: true,
  metadata: { userId: 'user-123' },
  debug: true,
});
```

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
| `TCC_BASE_URL` | Custom TCC base URL (overrides auto-detection) |

# @contextcompany/pi

Instrumentation and a Pi extension for the [Pi Agent SDK](https://github.com/badlogic/pi-mono).

## Quick Start

### Pi CLI extension

Install the package as a Pi extension:

```bash
pi install npm:@contextcompany/pi
```

Set your API key:

```bash
export TCC_API_KEY="your_api_key"
```

Start Pi as usual. The extension automatically records Pi agent runs, messages, and tool executions. Run `/tcc-status` inside Pi to confirm the extension is active.

### Programmatic SDK instrumentation

#### 1. Install

```bash
pnpm add @contextcompany/pi
```

#### 2. Set your API key

```bash
export TCC_API_KEY="your_api_key"
```

#### 3. Instrument your session

```typescript
import { instrumentPiSession } from "@contextcompany/pi";
import { createAgentSession } from "@mariozechner/pi-coding-agent";

const { session } = await createAgentSession();

instrumentPiSession(session, {
  sessionId: "conversation-123",
  conversational: true,
});

await session.prompt("What files are in the current directory?");
```

## Configuration

```typescript
instrumentPiSession(session, {
  apiKey: "tcc_abc123",
  sessionId: "conversation-123",
  conversational: true,
  metadata: { userId: "user-123" },
  debug: true,
});
```

| Option           | Type                      | Default           | Description                 |
| ---------------- | ------------------------- | ----------------- | --------------------------- |
| `apiKey`         | `string`                  | `TCC_API_KEY` env | TCC API key                 |
| `endpoint`       | `string`                  | Auto-detected     | Custom TCC endpoint URL     |
| `runId`          | `string`                  | Auto-generated    | Fixed run ID for all runs   |
| `sessionId`      | `string`                  | —                 | Group related runs together |
| `conversational` | `boolean`                 | —                 | Mark as conversational flow |
| `metadata`       | `Record<string, unknown>` | —                 | Custom metadata per run     |
| `debug`          | `boolean`                 | `false`           | Enable debug logging        |

## Environment Variables

| Variable             | Description                                                 |
| -------------------- | ----------------------------------------------------------- |
| `TCC_API_KEY`        | Your Context Company API key                                |
| `TCC_BASE_URL`       | Custom TCC base URL (overrides auto-detection)              |
| `TCC_PI_ENDPOINT`    | Custom Pi ingestion endpoint URL                            |
| `TCC_SESSION_ID`     | Session ID used by the Pi extension                         |
| `TCC_CONVERSATIONAL` | Set to `false` to mark extension runs as non-conversational |
| `TCC_AGENT_NAME`     | Agent name attached as `tcc.agent` metadata                 |
| `TCC_USER_ID`        | User ID attached as `tcc.userId` metadata                   |
| `TCC_USER_NAME`      | User name attached as `tcc.userName` metadata               |
| `TCC_ORG_ID`         | Organization ID attached as `tcc.orgId` metadata            |
| `TCC_ORG_NAME`       | Organization name attached as `tcc.orgName` metadata        |
| `TCC_DEBUG`          | Enable debug logging for SDK and extension instrumentation  |

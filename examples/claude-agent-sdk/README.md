# Claude Agent SDK Example with TCC Instrumentation

A simple example demonstrating the Claude Agent SDK with The Context Company telemetry.

## Features

- **Single tool** (`get_user_info`) for retrieving user information
- **TCC instrumentation** for telemetry collection
- **Feedback submission** with thumbs up/down
- **Interactive conversation** with session tracking

## Setup

1. **Install dependencies**:
   ```bash
   pnpm install
   pnpm --filter @contextcompany/api build
   pnpm --filter @contextcompany/claude build
   ```

2. **Configure environment**:
   Copy `.env.example` to `.env` and add your API keys:
   ```bash
   cp .env.example .env
   ```

3. **Run the example**:
   ```bash
   pnpm dev
   ```

## Usage

Ask questions about users:
- "Tell me about user-001"
- "What is user-002's email?"
- "What plan is user-003 on?"

Give feedback on responses:
- Type `up` for thumbs up 👍
- Type `down` for thumbs down 👎
- Type `exit` to quit

## Mock Data

Available users:
- **user-001**: Alice Johnson (Pro plan)
- **user-002**: Bob Smith (Free plan)
- **user-003**: Carol White (Enterprise plan)

## TCC Instrumentation

The example shows how to:
1. Wrap the Claude Agent SDK with `instrumentClaudeAgent()`
2. Pass TCC configuration in the `query()` call
3. Submit user feedback with `submitFeedback()`

Each conversation has a unique `sessionId`, and each query has a unique `runId` for tracking in TCC.

## Compatibility

Verified with Claude Agent SDK `0.3.273` and Zod 4. This workspace example uses the local `@contextcompany/claude` package. TCC session IDs group traces; pass the SDK resume option if you want Claude to retain conversation context between `query()` calls.

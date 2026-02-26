# Custom TypeScript Example

A simulated multi-agent system instrumented with `@contextcompany/custom`,
demonstrating both SDK patterns.

## What it shows

- **Builder pattern** — wrapping a live agent run, recording steps and tool
  calls as they happen, then sending everything in a single batch
- **Error handling** — calling `r.error()` to auto-close un-ended children
- **Factory pattern** — sending a complete run with nested steps and tool calls
  from pre-built data

No real LLM calls are made — the agent responses are scripted so the example
runs without API keys (only `TCC_API_KEY` is needed to send telemetry).

## Setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy `.env.example` to `.env` and add your TCC API key:

   ```bash
   cp .env.example .env
   ```

3. Run:

   ```bash
   pnpm dev
   ```

## Files

| File           | Description                                      |
| -------------- | ------------------------------------------------ |
| `src/index.ts` | Entry point — runs builder and factory examples  |
| `src/agent.ts` | Simulated agent with scripted LLM responses      |
| `src/tools.ts` | Mock tool implementations and definitions        |

# Claude Code Stream Example with TCC Instrumentation

A minimal example showing how to trace Claude Code CLI output into The Context Company when Claude is running inside a Daytona sandbox.

This example is designed for the workflow described in Daytona's Claude Code guide:

- run Claude Code in a PTY inside the sandbox
- enable machine-readable output with `--output-format stream-json`
- forward the PTY chunks into `ClaudeCodeStreamCollector`

## Why this example exists

`@contextcompany/claude` already supports the Claude Agent SDK directly via `instrumentClaudeAgent()`.

Some customers, however, are already running the Claude Code CLI directly in Daytona with:

```bash
claude -p "..." --output-format stream-json --verbose --include-partial-messages
```

For that setup, this example shows how to capture the CLI's newline-delimited JSON stream and send it to TCC using the same Claude ingestion endpoint as the Agent SDK integration.

## Setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Configure environment variables:

   ```bash
   export DAYTONA_API_KEY=...
   export ANTHROPIC_API_KEY=...
   export TCC_API_KEY=...
   ```

3. Run the example:

   ```bash
   pnpm dev
   ```

## Notes

- This example uses `--output-format stream-json --verbose --include-partial-messages` because that is the richest machine-readable Claude Code stream.
- The collector ignores non-JSON shell noise, which makes it suitable for PTY output in sandbox environments.
- If you control the agent implementation inside the sandbox, using the Claude Agent SDK directly is still the preferred integration because it avoids PTY parsing entirely and is already supported by `instrumentClaudeAgent()`.

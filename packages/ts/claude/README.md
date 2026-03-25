# @contextcompany/claude

This package contains The Context Company's instrumentation for Anthropic's
Claude runtimes.

It supports two integration patterns:

1. **Claude Agent SDK instrumentation** via `instrumentClaudeAgent()`
2. **Claude Code CLI stream collection** via `ClaudeCodeStreamCollector` or
   `collectClaudeCodeStream()`

For setup instructions, see our
[documentation](https://docs.thecontext.company/frameworks/claude-agent-sdk/setup).

## Which Claude integration should I use?

### Prefer the Agent SDK when you control execution

If you can run the Anthropic Agent SDK directly in your environment, that is
the cleanest integration. It gives you structured Claude messages without
having to parse PTY output.

This is also a good fit for Daytona sandboxes when Claude is running as an SDK
agent inside the sandbox instead of as a raw CLI process.

### Use the Claude Code stream collector for PTY-based execution

If your environment already runs Claude Code as a CLI command, such as:

```bash
claude -p "..." --output-format stream-json --verbose --include-partial-messages
```

you can feed the resulting stdout or PTY stream into the stream collector. This
is especially useful for Daytona flows that stream logs from a long-running PTY.

The collector is tolerant of:

- newline-delimited `stream-json` output
- shell echoes around the Claude command
- ANSI escape sequences from PTY sessions
- non-JSON log lines mixed into the stream

## Claude Agent SDK example

```ts
import * as claudeSDK from "@anthropic-ai/claude-agent-sdk";
import { instrumentClaudeAgent } from "@contextcompany/claude";

const { query } = instrumentClaudeAgent(claudeSDK);

for await (const message of query({
  prompt: "Explain this repository",
  tcc: {
    sessionId: crypto.randomUUID(),
    metadata: { environment: "sandbox" },
  },
})) {
  if (message.type === "assistant") {
    console.log(message.message);
  }
}
```

## Claude Code CLI stream example

```ts
import { collectClaudeCodeStream } from "@contextcompany/claude";

const result = await collectClaudeCodeStream(daytonaPtyOutput, {
  userPrompt: "Summarize this project",
  tcc: {
    sessionId: crypto.randomUUID(),
    metadata: {
      provider: "daytona",
      runtime: "claude-code",
    },
  },
});

console.log(result.parsedMessages);
```

Where `daytonaPtyOutput` is any `AsyncIterable<string | Uint8Array>` sourced
from the sandbox process output.

## Daytona recommendation

If your customer is already following Daytona's Claude Code guide and invoking
the CLI inside a sandbox PTY, the most practical path is:

1. run Claude Code with `--output-format stream-json --verbose`
2. include `--include-partial-messages` when you want token-by-token and tool
   streaming events
3. pass the PTY output into `ClaudeCodeStreamCollector`
4. call `.finish()` after the process exits to flush the collected run

If you are building a new Daytona integration from scratch, prefer running the
Anthropic Agent SDK inside the sandbox and wrapping it with
`instrumentClaudeAgent()`.

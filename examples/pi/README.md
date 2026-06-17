# Pi Examples

This example covers both ways to use `@contextcompany/pi`.

## Pi CLI extension

Install the local workspace package into Pi:

```bash
pnpm --filter @contextcompany/pi build
cd examples/pi
./node_modules/.bin/pi install ../../packages/ts/pi --local
```

After publishing, users can install the same extension from npm:

```bash
pi install npm:@contextcompany/pi
```

Then run Pi normally:

```bash
export TCC_API_KEY="your_api_key"
./node_modules/.bin/pi
```

The extension records Pi agent runs, messages, and tool executions automatically. Use `/tcc-status` inside Pi to check that it is active.

For a local no-LLM smoke test of the extension event flow:

```bash
pnpm extension
```

For a real Pi CLI smoke test after local install:

```bash
pnpm extension:cli "Say hello in one short sentence."
```

## Programmatic SDK instrumentation

Run the SDK example with a real Pi agent session:

```bash
pnpm sdk "Say hello in one sentence."
```

This starts a local collector and passes its URL to `instrumentPiSession()`, so you can see the payload that would be sent to TCC.
The SDK example disables Pi extension discovery so installing the extension locally does not double-record the same run.

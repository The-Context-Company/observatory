# contextcompany

The Context Company AI Agent Observability SDK for Python.

For setup instructions, see our [documentation](https://docs.thecontextcompany.com).

## Claude Agent SDK

The `claude` extra supports Claude Agent SDK `>=0.2.153,<0.3` (Python 3.10+).

```bash
pip install 'contextcompany[claude]'
```

Use `contextcompany.claude.instrument_claude_agent()` for `query()` or wrap an existing `ClaudeSDKClient` with `contextcompany.claude.instrument_claude_client(client)`. Both collect messages automatically. The stateful client records one run per response and converts cumulative SDK costs to per-turn costs.

See [the Python example](../../examples/claude-agent-sdk-python/README.md) for setup, metadata, streaming, and shutdown handling.

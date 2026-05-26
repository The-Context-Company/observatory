# contextcompany

The Context Company AI Agent Observability SDK for Python.

For setup instructions, see our [documentation](https://docs.thecontext.company).

## LangChain local mode

For local LangChain/LangGraph development, you can export traces to a local OTLP
HTTP collector without setting a TCC API key:

```python
from contextcompany.langchain import instrument_langchain

instrument_langchain(local=True)
```

By default, local mode sends traces to `http://localhost:4318/v1/traces`. To use
a different collector or proxy endpoint, pass `tcc_url` or set
`TCC_LOCAL_OTLP_ENDPOINT`.

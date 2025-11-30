# contextcompany

The Context Company AI Agent Observability SDK for Python.

## Installation

### Base Package

Install the base package for feedback functionality:

```bash
pip install contextcompany
```

### With Framework Support

Install with LangChain instrumentation:

```bash
pip install contextcompany[langchain]
```

## Usage

### Base Functionality

Submit feedback for AI agent runs:

```python
from contextcompany import submit_feedback

# Submit feedback with score
submit_feedback(
    run_id="your-run-id",
    score="thumbs_up",
    api_key="your-api-key"  # or set TCC_API_KEY env var
)

# Submit feedback with text
submit_feedback(
    run_id="your-run-id",
    text="Great response!",
    api_key="your-api-key"
)
```

### LangChain Instrumentation

Instrument your LangChain application:

```python
from contextcompany.langchain import instrument_langchain

# Initialize instrumentation
instrument_langchain(
    api_key="your-api-key"  # or set TCC_API_KEY env var
)

# Your LangChain code here - it will be automatically instrumented
```

## Environment Variables

- `TCC_API_KEY` - Your Context Company API key (required)
- `TCC_URL` - Custom endpoint URL (optional, for advanced use)
- `TCC_FEEDBACK_URL` - Custom feedback endpoint URL (optional, for advanced use)

## Links

- Documentation: https://docs.thecontext.company
- Website: https://www.thecontext.company
- Repository: https://github.com/The-Context-Company/observatory
- Issues: https://github.com/The-Context-Company/observatory/issues

# LangChain Agent Example (Python)

A Python application demonstrating LangChain agent capabilities with multiple specialized agents and tool usage, instrumented with OpenTelemetry to send traces to The Context Company platform.

## Features

This application includes **3 specialized agents**, each with their own set of tools:

### 🎫 Support Agent (Default)
Handles customer support tasks with 5 tools:
- `get_user_profile` - Retrieve user account information
- `create_ticket` - Create new support tickets
- `update_ticket_status` - Update ticket status
- `update_account_status` - Manage account settings
- `search_tickets` - Search existing tickets

### ✈️ Travel Agent
Helps plan trips with 5 tools:
- `get_destination_info` - Get destination details
- `get_weather_forecast` - Check weather conditions
- `find_hotels` - Search hotels by budget
- `get_attractions` - Discover attractions and activities
- `calculate_trip_budget` - Calculate trip costs

### 📚 Documentation Agent
Assists with documentation queries with 4 tools:
- `search_docs` - Search documentation by keywords
- `get_documentation` - Retrieve full documentation articles
- `list_categories` - List all doc categories
- `find_related_docs` - Find related articles

## Setup

### 1. Install Dependencies

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Set Environment Variables

```bash
cp .env.example .env
```

Edit `.env` and add your API keys:

```bash
# Required: OpenAI API key
OPENAI_API_KEY=sk-proj-your_openai_api_key_here

# Required: TCC API key
TCC_API_KEY=your_tcc_api_key_here

# Optional: TCC endpoint (defaults to production)
TCC_OTLP_URL=http://localhost:8787/v1/traces
```

**Note**: The Context Company platform supports both JSON and protobuf formats. The Python SDK sends protobuf by default, which is automatically handled by the TCC endpoint.

## Running

### Interactive Mode

```bash
python main.py
```

This starts an interactive chat session where you can talk to the agent.

### Single Query Mode

```bash
python main.py "Look up user-001's account information"
```

## Switching Agents

Edit `main.py` and change the agent configuration:

```python
# Support Agent (default)
agent = create_support_agent()

# Travel Agent
# agent = create_travel_agent()

# Documentation Agent
# agent = create_documentation_agent()
```

## Example Queries

### Support Agent
- "I need help with ticket ticket-001"
- "Can you look up user-002's account information?"
- "Create a high priority technical ticket for user-001 about login issues"
- "Search for all open tickets"

### Travel Agent
- "I want to plan a trip to Tokyo"
- "What's the weather like in Paris?"
- "Find me budget hotels in Bali"
- "Calculate the budget for a 5-day trip to Paris with a hotel at $180/night"

### Documentation Agent
- "How do I get started with authentication?"
- "Search for information about webhooks"
- "Show me the API reference documentation"
- "Find articles related to error-handling"

## Architecture

### Directory Structure

```
langchain-agent/
├── tcc_otel/              # TCC OpenTelemetry package (will be pip installable)
│   ├── __init__.py
│   ├── instrumentation.py
│   └── pyproject.toml
├── agents/                 # Agent definitions
│   ├── __init__.py
│   ├── support.py         # Support agent tools & config
│   ├── travel.py          # Travel agent tools & config
│   └── documentation.py   # Documentation agent tools & config
├── main.py                # Main entry point
├── requirements.txt       # Python dependencies
├── .env.example          # Environment variables template
└── README.md             # This file
```

### OpenTelemetry Instrumentation

This example uses the `tcc_otel` package to instrument LangChain with OpenTelemetry. The package:

1. Configures OpenTelemetry SDK with TCC endpoint
2. Instruments LangChain using `opentelemetry-instrumentation-langchain`
3. Exports traces to TCC via OTLP/HTTP
4. Automatically captures:
   - LLM calls (model, tokens, latency)
   - Tool executions (inputs, outputs, duration)
   - Agent reasoning steps
   - Chain executions

### What Gets Traced

All LangChain operations are automatically instrumented:
- ✅ **LLM calls** - OpenAI API requests and responses
- ✅ **Tool executions** - Every tool call with inputs and outputs
- ✅ **Agent reasoning** - ReAct agent thought process
- ✅ **Token usage** - Input/output tokens per call
- ✅ **Latency metrics** - Duration of each operation
- ✅ **Error tracking** - Failures and exceptions

### LangChain Span Structure

LangChain spans use OpenTelemetry semantic conventions:

**LLM Call Attributes:**
- `gen_ai.request.model` - Model name (e.g., "gpt-4")
- `gen_ai.usage.input_tokens` - Prompt tokens
- `gen_ai.usage.output_tokens` - Completion tokens
- `gen_ai.completion` - Full response text

**Tool Call Attributes:**
- `traceloop.entity.name` - Tool name
- `traceloop.entity.input` - JSON string of tool arguments
- `traceloop.entity.output` - JSON string of tool result

**Agent/Chain Attributes:**
- `traceloop.workflow.name` - Workflow/agent name
- `traceloop.entity.input` - Input messages
- `traceloop.entity.output` - Output messages

## Mock Data

All tools use **hardcoded mock data** for simplicity:
- 3 mock users (user-001, user-002, user-003)
- 2 initial mock tickets
- 3 destinations (Paris, Tokyo, Bali) with hotels and attractions
- 6 documentation articles

## Technologies

- **Python 3.11+** - Programming language
- **LangChain** - LLM orchestration framework
- **OpenAI GPT-4** - Language model
- **OpenTelemetry** - Observability instrumentation
- **OTLP** - OpenTelemetry Protocol for trace export

## tcc_otel Package

The `tcc_otel` package in this example will eventually be published to PyPI as `contextcompany-otel` for easy installation:

```bash
pip install contextcompany-otel
```

For now, it's included in this example directory and demonstrates the instrumentation pattern.

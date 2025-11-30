# LangChain Agent Example

A simple Python weather agent built with **pure LangChain** (using `AgentExecutor` and `create_react_agent`), instrumented with The Context Company (TCC) for full observability.

> **Note:** This example uses pure LangChain agents, not LangGraph. For a LangGraph example, see the separate `langgraph/` folder.

## What This Example Demonstrates

This example shows how to:
- Build a LangChain ReAct agent with custom tools
- Use `AgentExecutor` for agent execution
- Instrument your agent with TCC for automatic trace collection
- Track individual AI calls with unique run IDs
- Track conversation sessions with session IDs
- Submit user feedback (thumbs up/down) for specific runs
- Add custom metadata for filtering and grouping in the TCC dashboard

## Features

- **Simple Weather Agent** - Ask about current weather or forecasts
- **Two Tools** - `get_weather` and `get_forecast` with mock data
- **Pure LangChain** - Uses `AgentExecutor` and `create_react_agent` (not LangGraph)
- **Full Observability** - Automatic tracking of:
  - LLM calls (model, tokens, latency)
  - Tool executions (inputs, outputs, duration)
  - Agent reasoning steps (ReAct pattern)
  - Errors and exceptions
- **Feedback System** - Give thumbs up/down after agent responses
- **Session Tracking** - Track entire conversations with unique session IDs

## Setup

### 1. Install Dependencies

```bash
# Create and activate virtual environment
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

# Required: TCC API key (get yours at https://thecontext.company)
TCC_API_KEY=your_tcc_api_key_here

# Optional: Custom TCC endpoint (defaults to production)
# TCC_URL=http://localhost:8787/v1/traces
```

## Running the Example

### Interactive Mode

Start a conversation with the weather agent:

```bash
python main.py
```

**Example interaction:**

```
🌤️  LangChain Weather Agent Example
============================================================
This agent can help you check weather conditions!

Commands:
  • Type your weather question naturally
  • Type 'up' to give thumbs up feedback on the last response
  • Type 'down' to give thumbs down feedback
  • Type 'exit' or 'quit' to end the session
============================================================

[Session ID: a1b2c3d4-...]

👤 You: What's the weather like in San Francisco?

🤖 Agent:
[Run ID: e5f6g7h8-...]

> Entering new AgentExecutor chain...
Thought: I need to use the get_weather tool to check the weather in San Francisco
Action: get_weather
Action Input: San Francisco
Observation: {'location': 'San Francisco', 'temperature_f': 65, 'conditions': 'Partly cloudy', 'humidity': 70}
Thought: I now know the final answer
Final Answer: The current weather in San Francisco is partly cloudy with a temperature of 65°F and 70% humidity.

> Finished chain.

The current weather in San Francisco is partly cloudy with a temperature of 65°F and 70% humidity.

👤 You: up
👍 Submitting thumbs up feedback...
✅ Feedback submitted successfully!
```

### Single Query Mode

Run a single query and exit:

```bash
python main.py "What's the weather forecast for Tokyo?"
```

## How TCC Integration Works

### 1. Initialize Instrumentation

```python
from contextcompany.langchain import instrument_langchain

# TCC: Initialize OpenTelemetry instrumentation
# This must be called BEFORE importing LangChain components
# Automatically reads TCC_API_KEY and TCC_URL from environment
instrument_langchain()
```

### 2. Create LangChain Agent

```python
from langchain.agents import AgentExecutor, create_react_agent
from langchain_core.prompts import PromptTemplate
from langchain_openai import ChatOpenAI

# Initialize LLM and tools
llm = ChatOpenAI(model="gpt-4o", temperature=0.7)
tools = [get_weather, get_forecast]

# Create ReAct prompt template
prompt = PromptTemplate.from_template(template)

# Create the agent and executor
agent = create_react_agent(llm, tools, prompt)
agent_executor = AgentExecutor(
    agent=agent,
    tools=tools,
    verbose=True,
    handle_parsing_errors=True,
    max_iterations=10
)
```

### 3. Track Individual Runs

```python
import uuid

# TCC: Generate unique IDs for tracking
run_id = str(uuid.uuid4())        # Track this specific AI call
session_id = str(uuid.uuid4())    # Track the conversation

# Pass metadata when invoking the agent
result = agent_executor.invoke(
    {"input": user_input},
    {
        "metadata": {
            # TCC: Special tracking IDs
            "tcc.runId": run_id,          # Required for feedback
            "tcc.sessionId": session_id,  # Optional: group runs by session

            # TCC: Add your own custom metadata
            "agentName": "weather-agent",
            "environment": "production",
            "userId": "user-123",
        }
    }
)
```

### 4. Submit Feedback

```python
from contextcompany import submit_feedback

# TCC: Submit user feedback for a specific run
submit_feedback(
    run_id=run_id,
    score="thumbs_up"  # or "thumbs_down"
)
```

## What Gets Traced

TCC automatically captures:

- **✅ LLM Calls** - Model name, prompt, completion, token usage
- **✅ Tool Executions** - Tool name, inputs, outputs, duration
- **✅ Agent Steps** - ReAct reasoning (Thought/Action/Observation cycles)
- **✅ Errors** - Exceptions and failures
- **✅ Custom Metadata** - Your own tags for filtering/grouping

## Example Queries

Try asking the agent:
- "What's the weather in Tokyo?"
- "Give me a 5-day forecast for London"
- "How's the weather in New York?"
- "What should I wear in San Francisco today?"

## Code Structure

```
langchain/
├── main.py              # Main application with TCC integration
├── requirements.txt     # Python dependencies (pure LangChain)
├── .env.example        # Environment variables template
└── README.md           # This file
```

## Key Files Explained

### `main.py`

All-in-one file containing:
- **Tool Definitions** (`@tool` decorated functions)
- **Agent Creation** (`create_weather_agent()` using `AgentExecutor`)
- **ReAct Prompt Template** (standard LangChain ReAct format)
- **TCC Integration** (instrumentation + feedback)
- **Interactive CLI** (with session and run tracking)

### `requirements.txt`

Dependencies:
- `contextcompany[langchain]` - TCC OpenTelemetry SDK with LangChain support
- `langchain` - LLM orchestration framework (pure LangChain)
- `langchain-openai` - OpenAI integration for LangChain
- `langchain-core` - Core LangChain components
- `python-dotenv` - Environment variable management

**Note:** This example uses pure LangChain without LangGraph.

## Architecture Notes

### LangChain vs LangGraph

This example uses **pure LangChain** with:
- `create_react_agent()` - Creates a ReAct-style agent
- `AgentExecutor` - Executes the agent with tool calling
- `PromptTemplate` - Defines the ReAct prompt format

**Not using LangGraph** (for a LangGraph example, see the separate folder).

### ReAct Pattern

The agent uses the ReAct (Reasoning + Acting) pattern:
1. **Thought** - Agent thinks about what to do
2. **Action** - Agent decides which tool to use
3. **Action Input** - Agent provides tool input
4. **Observation** - Tool returns result
5. Repeat until agent has final answer

## Notes

- All weather data is **mocked** for demonstration purposes
- The agent uses **GPT-4o** by default (configurable in code)
- TCC sends traces via **OTLP/HTTP** in protobuf format
- **Session IDs** help you group related runs in the TCC dashboard
- **Run IDs** are required for feedback submission
- Agent output is verbose (`verbose=True`) to show ReAct steps

## Troubleshooting

**Agent not responding?**
- Check that `OPENAI_API_KEY` is set correctly
- Ensure you have credits in your OpenAI account

**Traces not appearing in TCC dashboard?**
- Verify `TCC_API_KEY` is correct
- Check network connectivity to TCC endpoint
- Look for error messages in console output

**Feedback not working?**
- Ensure you used a `run_id` when invoking the agent
- Check that the `run_id` matches what was sent to TCC

**Agent parsing errors?**
- The example has `handle_parsing_errors=True` to handle LLM format mistakes
- If you see repeated parsing errors, the LLM may need a better prompt

## Next Steps

- Explore the TCC dashboard to see your traces
- Add more tools to the agent
- Customize the ReAct prompt template
- Add your own metadata for filtering
- Try different LLM models
- Check out the LangGraph example for graph-based agents

## Learn More

- [The Context Company Documentation](https://docs.thecontext.company)
- [LangChain Documentation](https://python.langchain.com/)
- [LangChain Agents Guide](https://python.langchain.com/docs/modules/agents/)
- [ReAct Pattern Paper](https://arxiv.org/abs/2210.03629)

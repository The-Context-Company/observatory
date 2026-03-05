"""
LangChain Agent Example with The Context Company (TCC) Observability

This example demonstrates a simple LangChain agent with weather tools,
instrumented with TCC for full observability of LLM calls, tool executions,
and agent reasoning.
"""

import os
import sys
from dotenv import load_dotenv
import uuid

# Load environment variables
load_dotenv()

# TCC: Import and initialize OpenTelemetry instrumentation for LangChain
from contextcompany.langchain import instrument_langchain
from contextcompany import submit_feedback

# TCC: Initialize instrumentation
# This automatically captures all LangChain operations (LLM calls, tool executions, agent steps)
# Reads TCC_API_KEY and TCC_URL from environment variables
instrument_langchain()

# Now import LangChain components (after instrumentation is set up)
from langchain.agents import create_agent
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI


# ============================================================================
# Define Tools
# ============================================================================

@tool
def get_weather(location: str) -> dict:
    """
    Get the current weather for a location.

    Args:
        location: The city name (e.g., 'San Francisco', 'Tokyo')

    Returns:
        Weather information including temperature and conditions
    """
    mock_weather = {
        "San Francisco": {"temp": 65, "conditions": "Partly cloudy", "humidity": 70},
        "Tokyo": {"temp": 72, "conditions": "Sunny", "humidity": 60},
        "London": {"temp": 55, "conditions": "Rainy", "humidity": 85},
        "New York": {"temp": 58, "conditions": "Overcast", "humidity": 75},
    }

    weather = mock_weather.get(location, {"temp": 70, "conditions": "Unknown location - using default", "humidity": 65})

    return {
        "location": location,
        "temperature_f": weather["temp"],
        "conditions": weather["conditions"],
        "humidity": weather["humidity"]
    }


@tool
def get_forecast(location: str, days: int = 3) -> dict:
    """
    Get the weather forecast for a location.

    Args:
        location: The city name
        days: Number of days to forecast (1-7)

    Returns:
        Multi-day weather forecast
    """
    forecast = []
    base_temp = 70

    for day in range(min(days, 7)):
        forecast.append({
            "day": day + 1,
            "temp_high": base_temp + day * 2,
            "temp_low": base_temp - day * 2,
            "conditions": ["Sunny", "Cloudy", "Rainy", "Partly cloudy"][day % 4]
        })

    return {
        "location": location,
        "forecast": forecast
    }


# ============================================================================
# Create Agent
# ============================================================================

def create_weather_agent():
    """Create a LangChain weather agent with tools."""
    llm = ChatOpenAI(model="gpt-4o", temperature=0.7)
    tools = [get_weather, get_forecast]

    system_prompt = """You are a helpful weather assistant.

When users ask about weather:
1. Use get_weather to check current conditions
2. Use get_forecast for future weather predictions
3. Provide clear, friendly responses with the weather information"""

    agent = create_agent(
        model=llm,
        tools=tools,
        system_prompt=system_prompt
    )

    return agent


# ============================================================================
# Main Application
# ============================================================================

def run_interactive():
    """Run the agent in interactive mode with TCC tracking."""
    print("\n" + "=" * 60)
    print("LangChain Weather Agent Example")
    print("=" * 60)
    print("\nThis agent can help you check weather conditions!")
    print("\nCommands:")
    print("  Type your weather question naturally")
    print("  Type 'up' to give thumbs up feedback on the last response")
    print("  Type 'down' to give thumbs down feedback")
    print("  Type 'exit' or 'quit' to end the session")
    print("=" * 60 + "\n")

    agent = create_weather_agent()

    # TCC: Generate a unique session ID to track this conversation
    session_id = str(uuid.uuid4())
    print(f"[Session ID: {session_id}]\n")

    previous_run_id = None

    while True:
        try:
            user_input = input("You: ").strip()

            if not user_input:
                continue

            if user_input.lower() in ["exit", "quit", "q"]:
                print("\nGoodbye!\n")
                break

            # Handle feedback commands
            if user_input.lower() in ["up", "down"]:
                if previous_run_id:
                    score = "thumbs_up" if user_input.lower() == "up" else "thumbs_down"
                    print(f"\nSubmitting {score} feedback...")
                    success = submit_feedback(run_id=previous_run_id, score=score)
                    print("Feedback submitted!\n" if success else "Failed to submit feedback\n")
                else:
                    print("\nNo previous run to give feedback on\n")
                continue

            print("\nAgent:")

            # TCC: Generate a unique run_id for this specific AI call
            current_run_id = str(uuid.uuid4())
            print(f"[Run ID: {current_run_id}]")

            # Invoke the agent with TCC metadata for tracking
            result = agent.invoke(
                {"messages": [{"role": "user", "content": user_input}]},
                config={
                    "metadata": {
                        "tcc.runId": current_run_id,
                        "tcc.sessionId": session_id,
                        "agentName": "weather-agent",
                        "environment": "development",
                    }
                }
            )

            previous_run_id = current_run_id

            if isinstance(result, dict) and "messages" in result:
                messages = result["messages"]
                if messages:
                    last_message = messages[-1]
                    content = getattr(last_message, 'content', last_message)
                    print(f"\n{content}\n")
            else:
                print(f"\n{result}\n")

        except KeyboardInterrupt:
            print("\n\nGoodbye!\n")
            break
        except Exception as e:
            print(f"\nError: {e}\n")


def run_single_query(query: str):
    """Run a single query and exit."""
    print(f"\nRunning query: {query}\n")

    agent = create_weather_agent()
    run_id = str(uuid.uuid4())
    print(f"[Run ID: {run_id}]")

    try:
        result = agent.invoke(
            {"messages": [{"role": "user", "content": query}]},
            config={
                "metadata": {
                    "tcc.runId": run_id,
                    "agentName": "weather-agent",
                    "environment": "development",
                }
            }
        )

        if isinstance(result, dict) and "messages" in result:
            messages = result["messages"]
            if messages:
                last_message = messages[-1]
                content = getattr(last_message, 'content', last_message)
                print(f"\nResult: {content}\n")
        else:
            print(f"\nResult: {result}\n")

    except Exception as e:
        print(f"\nError: {e}\n")
        sys.exit(1)


def main():
    if not os.getenv("OPENAI_API_KEY"):
        print("Error: OPENAI_API_KEY environment variable is not set")
        sys.exit(1)

    if not os.getenv("TCC_API_KEY"):
        print("Error: TCC_API_KEY environment variable is not set")
        sys.exit(1)

    if len(sys.argv) > 1:
        query = " ".join(sys.argv[1:])
        run_single_query(query)
    else:
        run_interactive()


if __name__ == "__main__":
    main()

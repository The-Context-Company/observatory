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
    # Mock weather data for demonstration
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
    # Mock forecast data
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
    """Create a LangChain weather agent with tools using LangChain 1.0+ API."""

    # Initialize the LLM
    llm = ChatOpenAI(model="gpt-4o", temperature=0.7)

    # Define available tools
    tools = [get_weather, get_forecast]

    # System prompt for the agent
    system_prompt = """You are a helpful weather assistant.

When users ask about weather:
1. Use get_weather to check current conditions
2. Use get_forecast for future weather predictions
3. Provide clear, friendly responses with the weather information"""

    # Create agent using LangChain 1.0+ create_agent API
    # This returns a CompiledStateGraph that handles the agent loop
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
    print("🌤️  LangChain Weather Agent Example")
    print("=" * 60)
    print("\nThis agent can help you check weather conditions!")
    print("\nCommands:")
    print("  • Type your weather question naturally")
    print("  • Type 'up' to give thumbs up feedback on the last response")
    print("  • Type 'down' to give thumbs down feedback")
    print("  • Type 'exit' or 'quit' to end the session")
    print("=" * 60 + "\n")

    # Create the weather agent
    agent = create_weather_agent()

    # TCC: Generate a unique session ID to track this conversation
    session_id = str(uuid.uuid4())
    print(f"[Session ID: {session_id}]\n")

    previous_run_id = None  # Track the previous run_id for feedback

    while True:
        try:
            user_input = input("👤 You: ").strip()

            if not user_input:
                continue

            if user_input.lower() in ["exit", "quit", "q"]:
                print("\n👋 Goodbye!\n")
                break

            # Handle feedback commands
            if user_input.lower() == "up":
                if previous_run_id:
                    print("\n👍 Submitting thumbs up feedback...")
                    # TCC: Submit positive feedback for the previous run
                    success = submit_feedback(run_id=previous_run_id, score="thumbs_up")
                    if success:
                        print("✅ Feedback submitted successfully!\n")
                    else:
                        print("❌ Failed to submit feedback\n")
                else:
                    print("\n⚠️  No previous run to give feedback on\n")
                continue

            if user_input.lower() == "down":
                if previous_run_id:
                    print("\n👎 Submitting thumbs down feedback...")
                    # TCC: Submit negative feedback for the previous run
                    success = submit_feedback(run_id=previous_run_id, score="thumbs_down")
                    if success:
                        print("✅ Feedback submitted successfully!\n")
                    else:
                        print("❌ Failed to submit feedback\n")
                else:
                    print("\n⚠️  No previous run to give feedback on\n")
                continue

            print("\n🤖 Agent:")

            # TCC: Generate a unique run_id for this specific AI call
            # This allows you to track individual agent invocations and submit feedback
            current_run_id = str(uuid.uuid4())
            print(f"[Run ID: {current_run_id}]")

            # Invoke the agent with the user's input
            # TCC: Pass metadata including run_id and session_id for tracking via config
            result = agent.invoke(
                {"messages": [{"role": "user", "content": user_input}]},
                config={
                    "metadata": {
                        # TCC: Special tracking IDs
                        "tcc.runId": current_run_id,      # Track this specific AI call
                        "tcc.sessionId": session_id,      # Track the conversation session

                        # TCC: Add your own custom metadata to filter/group in dashboard
                        "agentName": "weather-agent",
                        "environment": "development",
                    }
                }
            )

            # Store this run_id for potential feedback
            previous_run_id = current_run_id

            # Extract and display the agent's response
            if isinstance(result, dict) and "messages" in result:
                messages = result["messages"]
                if messages:
                    last_message = messages[-1]
                    if hasattr(last_message, 'content'):
                        print(f"\n{last_message.content}\n")
                    else:
                        print(f"\n{last_message}\n")
            else:
                print(f"\n{result}\n")

        except KeyboardInterrupt:
            print("\n\n👋 Goodbye!\n")
            break
        except Exception as e:
            print(f"\n❌ Error: {e}\n")


def run_single_query(query: str):
    """Run a single query and exit."""
    print(f"\n🌤️  Running query: {query}\n")

    # Create the weather agent
    agent = create_weather_agent()

    # TCC: Generate a unique run_id for this invocation
    run_id = str(uuid.uuid4())
    print(f"[Run ID: {run_id}]")

    try:
        # Invoke the agent with metadata
        result = agent.invoke(
            {"messages": [{"role": "user", "content": query}]},
            config={
                "metadata": {
                    # TCC: Tracking metadata
                    "tcc.runId": run_id,
                    "agentName": "weather-agent",
                    "environment": "development",
                }
            }
        )

        # Extract and display the result
        if isinstance(result, dict) and "messages" in result:
            messages = result["messages"]
            if messages:
                last_message = messages[-1]
                if hasattr(last_message, 'content'):
                    print(f"\n✅ Result: {last_message.content}\n")
                else:
                    print(f"\n✅ Result: {last_message}\n")
        else:
            print(f"\n✅ Result: {result}\n")

    except Exception as e:
        print(f"\n❌ Error: {e}\n")
        sys.exit(1)


def main():
    """Main entry point."""
    # Check if required API keys are set
    if not os.getenv("OPENAI_API_KEY"):
        print("❌ Error: OPENAI_API_KEY environment variable is not set")
        print("Please set it in your .env file or export it in your shell")
        sys.exit(1)

    if not os.getenv("TCC_API_KEY"):
        print("❌ Error: TCC_API_KEY environment variable is not set")
        print("Please set it in your .env file or export it in your shell")
        sys.exit(1)

    # Check if running in single query mode or interactive mode
    if len(sys.argv) > 1:
        query = " ".join(sys.argv[1:])
        run_single_query(query)
    else:
        run_interactive()


if __name__ == "__main__":
    main()

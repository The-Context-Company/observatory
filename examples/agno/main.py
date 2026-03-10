"""
Agno Agent Example with The Context Company (TCC) Observability

This example demonstrates an Agno agent with weather tools,
instrumented with TCC for full observability of agent runs,
LLM calls, and tool executions.
"""

import os
import sys

from dotenv import load_dotenv

load_dotenv()

# TCC: Import and initialize Agno instrumentation
# This must be called BEFORE creating any Agent instances
from contextcompany.agno import instrument_agno

instrument_agno()

# Now import Agno components (after instrumentation is set up)
from agno.agent import Agent
from agno.models.openai import OpenAIChat
from agno.tools.function import Function


# ============================================================================
# Define Tools
# ============================================================================


def get_weather(location: str) -> str:
    """Get the current weather for a location.

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

    weather = mock_weather.get(
        location,
        {"temp": 70, "conditions": "Unknown location - using default", "humidity": 65},
    )

    return (
        f"Weather in {location}: {weather['temp']}°F, "
        f"{weather['conditions']}, {weather['humidity']}% humidity"
    )


def get_forecast(location: str, days: int = 3) -> str:
    """Get the weather forecast for a location.

    Args:
        location: The city name
        days: Number of days to forecast (1-7)

    Returns:
        Multi-day weather forecast
    """
    forecasts = []
    base_temp = 70
    conditions = ["Sunny", "Cloudy", "Rainy", "Partly cloudy"]

    for day in range(min(days, 7)):
        forecasts.append(
            f"Day {day + 1}: High {base_temp + day * 2}°F, "
            f"Low {base_temp - day * 2}°F, {conditions[day % 4]}"
        )

    return f"Forecast for {location}:\n" + "\n".join(forecasts)


# ============================================================================
# Create Agent
# ============================================================================


def create_weather_agent() -> Agent:
    """Create an Agno weather agent with tools."""
    return Agent(
        name="WeatherAgent",
        model=OpenAIChat(id="gpt-4o"),
        tools=[get_weather, get_forecast],
        instructions=[
            "You are a helpful weather assistant.",
            "Use get_weather to check current conditions.",
            "Use get_forecast for future weather predictions.",
            "Provide clear, friendly responses with the weather information.",
        ],
        markdown=True,
    )


# ============================================================================
# Main Application
# ============================================================================


def run_single_query(query: str) -> None:
    """Run a single query and exit."""
    print(f"\nRunning query: {query}\n")

    agent = create_weather_agent()

    try:
        response = agent.run(query)
        print(f"\nResult: {response.content}\n")
    except Exception as e:
        print(f"\nError: {e}\n")
        sys.exit(1)


def run_interactive() -> None:
    """Run the agent in interactive mode."""
    print("\n" + "=" * 60)
    print("Agno Weather Agent Example")
    print("=" * 60)
    print("\nThis agent can help you check weather conditions!")
    print("\nCommands:")
    print("  Type your weather question naturally")
    print("  Type 'exit' or 'quit' to end the session")
    print("=" * 60 + "\n")

    agent = create_weather_agent()

    while True:
        try:
            user_input = input("You: ").strip()

            if not user_input:
                continue

            if user_input.lower() in ("exit", "quit", "q"):
                print("\nGoodbye!\n")
                break

            print("\nAgent:")
            response = agent.run(user_input)
            print(f"\n{response.content}\n")

        except KeyboardInterrupt:
            print("\n\nGoodbye!\n")
            break
        except Exception as e:
            print(f"\nError: {e}\n")


def main() -> None:
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

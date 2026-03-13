"""
CrewAI Example with The Context Company (TCC) Observability

This example demonstrates a CrewAI crew with weather tools,
instrumented with TCC for full observability of LLM calls
and tool executions.
"""

import os
import sys
import uuid

from dotenv import load_dotenv

load_dotenv()

# TCC: Import and initialize CrewAI instrumentation
# This must be called BEFORE creating any Crew, Agent, or Task instances
from contextcompany.crewai import instrument_crewai, set_metadata
from contextcompany import submit_feedback

instrument_crewai()

# Now import CrewAI components (after instrumentation is set up)
from crewai import Agent, Task, Crew, Process, LLM
from crewai.tools import tool


# ============================================================================
# Define Tools
# ============================================================================


@tool("Get Weather")
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


@tool("Get Forecast")
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
# Create Crew
# ============================================================================


def create_weather_crew(query: str) -> Crew:
    """Create a CrewAI weather crew with agents and tasks."""
    llm = LLM(model="gpt-4o", temperature=0.7)

    weather_agent = Agent(
        role="Weather Reporter",
        goal="Provide accurate and helpful weather information",
        backstory=(
            "You are an experienced weather reporter who can look up "
            "current conditions and forecasts for any location. You always "
            "provide clear, friendly responses with detailed weather data."
        ),
        tools=[get_weather, get_forecast],
        llm=llm,
        verbose=True,
    )

    weather_task = Task(
        description=(
            f"Answer the following weather question: {query}\n\n"
            "Use the available weather tools to look up current conditions "
            "and/or forecasts as needed. Provide a clear, helpful response."
        ),
        expected_output=(
            "A friendly, detailed weather report that directly answers "
            "the user's question with temperature, conditions, and any "
            "other relevant weather information."
        ),
        agent=weather_agent,
    )

    crew = Crew(
        agents=[weather_agent],
        tasks=[weather_task],
        process=Process.sequential,
        verbose=True,
    )

    return crew


# ============================================================================
# Main Application
# ============================================================================


def run_single_query(query: str) -> None:
    """Run a single query and exit."""
    print(f"\nRunning query: {query}\n")

    try:
        crew = create_weather_crew(query)
        # TCC: Just set metadata — the run is created automatically by instrument_crewai
        set_metadata({"agentName": "weather-crew", "environment": "development"})
        result = crew.kickoff()
        print(f"\nResult: {result.raw}\n")
    except Exception as e:
        print(f"\nError: {e}\n")
        sys.exit(1)


def run_interactive() -> None:
    """Run the crew in interactive mode with TCC tracking."""
    print("\n" + "=" * 60)
    print("CrewAI Weather Crew Example")
    print("=" * 60)
    print("\nThis crew can help you check weather conditions!")
    print("\nCommands:")
    print("  Type your weather question naturally")
    print("  Type 'up' to give thumbs up feedback on the last response")
    print("  Type 'down' to give thumbs down feedback")
    print("  Type 'exit' or 'quit' to end the session")
    print("=" * 60 + "\n")

    session_id = str(uuid.uuid4())
    print(f"[Session ID: {session_id}]\n")

    previous_run_id = None

    while True:
        try:
            user_input = input("You: ").strip()

            if not user_input:
                continue

            if user_input.lower() in ("exit", "quit", "q"):
                print("\nGoodbye!\n")
                break

            # Handle feedback commands
            if user_input.lower() in ("up", "down"):
                if previous_run_id:
                    score = "thumbs_up" if user_input.lower() == "up" else "thumbs_down"
                    print(f"\nSubmitting {score} feedback...")
                    success = submit_feedback(run_id=previous_run_id, score=score)
                    print("Feedback submitted!\n" if success else "Failed to submit feedback\n")
                else:
                    print("\nNo previous run to give feedback on\n")
                continue

            print("\nCrew:")

            crew = create_weather_crew(user_input)

            # TCC: Set metadata — run is created automatically on kickoff
            run_id = str(uuid.uuid4())
            set_metadata({
                "tcc.runId": run_id,
                "tcc.sessionId": session_id,
                "agentName": "weather-crew",
                "environment": "development",
            })
            result = crew.kickoff()

            previous_run_id = run_id
            print(f"\n{result.raw}\n")

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

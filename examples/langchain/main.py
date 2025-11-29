"""
Main entry point for the LangChain agent example.

This script demonstrates how to use LangChain agents with OpenTelemetry instrumentation
to send traces to The Context Company platform.
"""

import os
import sys
from dotenv import load_dotenv
import uuid

# Load environment variables FIRST
load_dotenv()

from tcc_otel import instrument_langchain, submit_feedback

instrument_langchain(
    api_key=os.getenv("TCC_API_KEY"),
    endpoint=os.getenv("TCC_OTLP_URL"),
)

# Now import agents
from agents import create_support_agent, create_travel_agent, create_documentation_agent


def run_interactive():
    """Run the agent in interactive mode."""
    print("\n" + "=" * 60)
    print("🤖 LangChain Agent Example")
    print("=" * 60)
    print("\nAvailable agents:")
    print("  1. Support Agent (customer service)")
    print("  2. Travel Agent (trip planning)")
    print("  3. Documentation Agent (knowledge base)")
    print("\nUsing: Support Agent (default)")
    print("\nType 'exit' or 'quit' to end the session")
    print("Type 'up' to give thumbs up to the previous run")
    print("Type 'down' to give thumbs down to the previous run")
    print("=" * 60 + "\n")

    # Create the agent (using support agent by default)
    agent = create_support_agent()

    # For other agents, uncomment:
    # agent = create_travel_agent()
    # agent = create_documentation_agent()

    agentSessionId = str(uuid.uuid4())
    previous_run_id = None  # Track the previous run_id for feedback

    while True:
        try:
            user_input = input("\n👤 You: ").strip()

            if not user_input:
                continue

            if user_input.lower() in ["exit", "quit", "q"]:
                print("\n👋 Goodbye!\n")
                break

            # Handle feedback commands
            if user_input.lower() == "up":
                if previous_run_id:
                    print("\n👍 Submitting thumbs up feedback...")
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
                    success = submit_feedback(run_id=previous_run_id, score="thumbs_down")
                    if success:
                        print("✅ Feedback submitted successfully!\n")
                    else:
                        print("❌ Failed to submit feedback\n")
                else:
                    print("\n⚠️  No previous run to give feedback on\n")
                continue

            print("\n🤖 Agent:")

            # Generate a unique run_id for this agent invocation
            current_run_id = str(uuid.uuid4())
            print(f"\n[Sending run_id: {current_run_id}]")

            # LangGraph agents use messages format
            # Pass custom metadata via RunnableConfig including the run_id
            result = agent.invoke(
                {"messages": [("user", user_input)]},
                {
                    "metadata": {
                        "agentName": "support-agent",
                        "environment": "development",
                        "tcc.sessionId": agentSessionId,
                        "tcc.runId": current_run_id,
                        "tcc.run_id": current_run_id,  # Try both formats
                    }
                }
            )

            # Store this run_id for potential feedback
            previous_run_id = current_run_id

            # Extract the final AI message
            if isinstance(result, dict) and "messages" in result:
                messages = result["messages"]
                # Get the last AI message
                for msg in reversed(messages):
                    if hasattr(msg, 'type') and msg.type == "ai":
                        print(f"\n{msg.content}\n")
                        break
            else:
                print(f"\n{result}\n")

        except KeyboardInterrupt:
            print("\n\n👋 Goodbye!\n")
            break
        except Exception as e:
            print(f"\n❌ Error: {e}\n")


def run_single_query(query: str):
    """Run a single query and exit."""
    print(f"\n🤖 Running query: {query}\n")

    # Create the agent
    agent = create_support_agent()

    # Generate a unique run_id for this agent invocation
    run_id = str(uuid.uuid4())
    print(f"[Run ID: {run_id}]")

    try:
        # LangGraph agents use messages format
        # Pass custom metadata via RunnableConfig including the run_id
        result = agent.invoke(
            {"messages": [("user", query)]},
            {
                "metadata": {
                    "agentName": "support-agent",
                    "environment": "development",
                    "tcc.runId": run_id,
                    "tcc.run_id": run_id,  # Try both formats
                }
            }
        )

        # Extract the final AI message
        if isinstance(result, dict) and "messages" in result:
            messages = result["messages"]
            for msg in reversed(messages):
                if hasattr(msg, 'type') and msg.type == "ai":
                    print(f"\n✅ Result: {msg.content}\n")
                    break
        else:
            print(f"\n✅ Result: {result}\n")

    except Exception as e:
        print(f"\n❌ Error: {e}\n")
        sys.exit(1)


def main():
    """Main entry point."""
    # Check if API keys are set
    if not os.getenv("OPENAI_API_KEY"):
        print("❌ Error: OPENAI_API_KEY environment variable is not set")
        print("Please set it in your .env file or export it in your shell")
        sys.exit(1)

    if not os.getenv("TCC_API_KEY"):
        print("❌ Error: TCC_API_KEY environment variable is not set")
        print("Please set it in your .env file or export it in your shell")
        sys.exit(1)

    # Check if running in single query mode
    if len(sys.argv) > 1:
        query = " ".join(sys.argv[1:])
        run_single_query(query)
    else:
        run_interactive()


if __name__ == "__main__":
    main()

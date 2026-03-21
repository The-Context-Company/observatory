"""
Claude Agent SDK Example with The Context Company (TCC) Observability

This example demonstrates the Claude Agent SDK for Python instrumented
with TCC for full observability of agent runs.  It mirrors the TypeScript
example in ``examples/claude-agent-sdk/``.

Features:
    - Interactive conversation with Claude via the Agent SDK
    - TCC instrumentation for telemetry collection
    - Session tracking across multiple queries
    - Feedback submission (thumbs up / thumbs down)
"""

import asyncio
import os
import sys
import uuid

from dotenv import load_dotenv

load_dotenv()

# TCC: Import and initialise Claude Agent SDK instrumentation
from contextcompany.claude import instrument_claude_agent, TCCConfig
from contextcompany import submit_feedback

# Create the instrumented agent — call once at startup
agent = instrument_claude_agent()


# ============================================================================
# Main Application
# ============================================================================


async def run_single_query(query: str) -> None:
    """Run a single query and exit."""
    from claude_agent_sdk import (
        AssistantMessage,
        ClaudeAgentOptions,
        ResultMessage,
        TextBlock,
    )

    print(f"\nRunning query: {query}\n")

    run_id = str(uuid.uuid4())
    print(f"[Run ID: {run_id}]")

    options = ClaudeAgentOptions(
        system_prompt=(
            "You are a helpful assistant. Answer the user's questions "
            "clearly and concisely."
        ),
        max_turns=3,
    )

    try:
        async for message in agent.query(
            prompt=query,
            options=options,
            tcc_config=TCCConfig(
                run_id=run_id,
                metadata={"environment": "development"},
            ),
        ):
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, TextBlock):
                        print(f"Claude: {block.text}")
            elif isinstance(message, ResultMessage):
                if hasattr(message, "total_cost_usd") and message.total_cost_usd:
                    print(f"\n[Cost: ${message.total_cost_usd:.4f}]")
    except Exception as e:
        print(f"\nError: {e}\n")
        sys.exit(1)


async def run_interactive() -> None:
    """Run the agent in interactive mode with TCC tracking."""
    from claude_agent_sdk import (
        AssistantMessage,
        ClaudeAgentOptions,
        ResultMessage,
        TextBlock,
    )

    print("\n" + "=" * 60)
    print("Claude Agent SDK Example with TCC Instrumentation")
    print("=" * 60)
    print("\nAsk Claude anything!")
    print("\nCommands:")
    print("  Type your question naturally")
    print("  Type 'up' to give thumbs up feedback on the last response")
    print("  Type 'down' to give thumbs down feedback")
    print("  Type 'exit' or 'quit' to end the session")
    print("=" * 60 + "\n")

    # TCC: Generate a unique session ID to track this conversation
    session_id = str(uuid.uuid4())
    print(f"[Session ID: {session_id}]\n")

    previous_run_id: str | None = None

    while True:
        try:
            user_input = input("You: ").strip()

            if not user_input:
                continue

            if user_input.lower() in ("exit", "quit", "q"):
                print("\n👋 Goodbye!\n")
                break

            # Handle feedback commands
            if user_input.lower() in ("up", "down"):
                if previous_run_id:
                    score = (
                        "thumbs_up" if user_input.lower() == "up" else "thumbs_down"
                    )
                    emoji = "👍" if score == "thumbs_up" else "👎"
                    print(f"\n{emoji} Submitting {score} feedback...")
                    success = submit_feedback(
                        run_id=previous_run_id, score=score
                    )
                    print(
                        "✅ Feedback submitted!\n"
                        if success
                        else "❌ Failed to submit feedback\n"
                    )
                else:
                    print("\n⚠️  No previous run to give feedback on\n")
                continue

            # TCC: Generate a unique run_id for this specific query
            current_run_id = str(uuid.uuid4())
            print(f"\n[Run ID: {current_run_id}]")
            print("\nAssistant:")

            options = ClaudeAgentOptions(
                system_prompt=(
                    "You are a helpful assistant. Answer the user's "
                    "questions clearly and concisely."
                ),
                max_turns=5,
            )

            # TCC: Query with instrumentation — telemetry is sent automatically
            async for message in agent.query(
                prompt=user_input,
                options=options,
                tcc_config=TCCConfig(
                    run_id=current_run_id,
                    session_id=session_id,
                    metadata={
                        "environment": "development",
                    },
                ),
            ):
                if isinstance(message, AssistantMessage):
                    for block in message.content:
                        if isinstance(block, TextBlock):
                            print(block.text)
                elif isinstance(message, ResultMessage):
                    if (
                        hasattr(message, "total_cost_usd")
                        and message.total_cost_usd
                    ):
                        print(f"\n[Cost: ${message.total_cost_usd:.4f}]")

            previous_run_id = current_run_id
            print()

        except KeyboardInterrupt:
            print("\n\n👋 Goodbye!\n")
            break
        except Exception as e:
            print(f"\nError: {e}\n")


async def main() -> None:
    if not os.getenv("ANTHROPIC_API_KEY"):
        print("Error: ANTHROPIC_API_KEY environment variable is not set")
        print("Get your API key from: https://console.anthropic.com/")
        sys.exit(1)

    if not os.getenv("TCC_API_KEY"):
        print("Error: TCC_API_KEY environment variable is not set")
        print("Get your API key from: https://thecontext.company")
        sys.exit(1)

    if len(sys.argv) > 1:
        query = " ".join(sys.argv[1:])
        await run_single_query(query)
    else:
        await run_interactive()


if __name__ == "__main__":
    asyncio.run(main())

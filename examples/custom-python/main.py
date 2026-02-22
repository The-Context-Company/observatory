"""
Example: In-house A2A-compatible multi-agent orchestration framework
instrumented with The Context Company SDK.

Stack:
- LiteLLM as the LLM gateway (routes to OpenAI, Anthropic, etc.)
- Mock tool calls (knowledge base, database, ticketing, email)
- TCC custom instrumentation for run-level observability

Usage:
    export OPENAI_API_KEY=sk-...
    export TCC_API_KEY=...
    python main.py
"""

import uuid
from dotenv import load_dotenv
from orchestrator import orchestrate

load_dotenv()


def main():
    print("=" * 50)
    print("Multi-Agent Framework + TCC Instrumentation")
    print("=" * 50)

    session_id = str(uuid.uuid4())

    requests = [
        "What were our Q3 revenue and churn numbers?",
        "Create a high-priority ticket to investigate the churn spike",
        "What is the capital of France?",
    ]

    for user_msg in requests:
        orchestrate(user_msg, session_id)

    print(f"\n{'=' * 50}")
    print("Done. All runs instrumented via TCC.")


if __name__ == "__main__":
    main()

"""
Orchestrator — the core of the in-house multi-agent framework.

Routes user requests through a router agent, handles handoffs to specialist
agents, and instruments every run with The Context Company SDK.
"""

import contextcompany as tcc
from llm import call_agent
from agents import AGENTS


def orchestrate(user_message: str, session_id: str) -> None:
    """
    Run the full orchestration flow for a single user message.

    1. Router agent decides: answer directly or hand off
    2. If handoff: specialist agent handles the request
    3. Each agent turn is instrumented as a separate TCC run
    """
    print(f"\nUser: {user_message}")
    print("-" * 50)

    # --- Router agent ---
    r = tcc.run(session_id=session_id, conversational=True)
    r.prompt(user_message)
    r.metadata(agent="router", model="gpt-4o", framework="in-house-a2a")

    try:
        router_response, router_tools = call_agent("router", user_message)
    except Exception as e:
        r.error(str(e))
        print(f"  Router error: {e}")
        return

    # Check for handoff
    handoff_target = None
    for t in router_tools:
        if t["tool"] == "handoff":
            handoff_target = t["args"]["agent"]

    if not handoff_target:
        # Router answered directly
        r.response(router_response)
        r.end()
        print(f"  Router: {router_response}")
        return

    # Log the routing decision and close the router run
    r.response(f"[handoff -> {handoff_target}]")
    r.end()
    print(f"  Router -> handoff to '{handoff_target}'")

    # --- Specialist agent ---
    specialist = tcc.run(session_id=session_id, conversational=True)
    specialist.prompt(user_message)
    specialist.metadata(
        agent=handoff_target,
        model=AGENTS[handoff_target]["model"],
        framework="in-house-a2a",
        routed_from="router",
    )

    try:
        response, tool_results = call_agent(handoff_target, user_message)

        for t in tool_results:
            print(f"  [{t['tool']}] {t['args']} -> {t['result']}")

        print(f"  {handoff_target.title()} Agent: {response}")
        specialist.response(response)
        specialist.end()
    except Exception as e:
        specialist.error(str(e))
        print(f"  {handoff_target.title()} Agent error: {e}")

"""
Orchestrator — the core of the in-house multi-agent framework.

Routes user requests through a router agent, handles handoffs to specialist
agents, and instruments every run with The Context Company SDK.

TCC Instrumentation overview:
- Each agent invocation is one TCC run (tcc_run_router, tcc_run_specialist)
- Each LLM call within an agent is one TCC step (created inside call_agent via tcc_run.step())
- All runs in a session share the same session_id
"""

import contextcompany as tcc
from llm import call_agent
from agents import AGENTS


def orchestrate(user_message: str, session_id: str) -> None:
    print(f"\nUser: {user_message}")
    print("-" * 50)

    # =====================================================================
    # TCC Run 1: Router agent
    # Instruments the router's full lifecycle (prompt in -> routing decision out)
    # =====================================================================
    tcc_run_router = tcc.run(session_id=session_id, conversational=True)
    tcc_run_router.prompt(user_message)
    tcc_run_router.metadata(agent="router", model="gpt-4o", framework="in-house-a2a")

    try:
        # call_agent creates TCC steps on tcc_run_router for each LLM call
        router_response, router_tools = call_agent("router", user_message, tcc_run=tcc_run_router)
    except Exception as e:
        tcc_run_router.error(str(e))
        print(f"  Router error: {e}")
        return

    # Check if router handed off to a specialist
    handoff_target = None
    for t in router_tools:
        if t["tool"] == "handoff":
            handoff_target = t["args"]["agent"]

    if not handoff_target:
        # Router answered directly — close the run
        tcc_run_router.response(router_response)
        tcc_run_router.end()  # sends run to TCC
        print(f"  Router: {router_response}")
        return

    # Router decided to hand off — log the routing decision and close
    tcc_run_router.response(f"[handoff -> {handoff_target}]")
    tcc_run_router.end()  # sends run to TCC
    print(f"  Router -> handoff to '{handoff_target}'")

    # =====================================================================
    # TCC Run 2: Specialist agent (research or action)
    # Instruments the specialist's full lifecycle (prompt in -> final answer out)
    # =====================================================================
    tcc_run_specialist = tcc.run(session_id=session_id, conversational=True)
    tcc_run_specialist.prompt(user_message)
    tcc_run_specialist.metadata(
        agent=handoff_target,
        model=AGENTS[handoff_target]["model"],
        framework="in-house-a2a",
        routed_from="router",
    )

    try:
        # call_agent creates TCC steps on tcc_run_specialist for each LLM call
        response, tool_results = call_agent(handoff_target, user_message, tcc_run=tcc_run_specialist)

        for t in tool_results:
            print(f"  [{t['tool']}] {t['args']} -> {t['result']}")

        print(f"  {handoff_target.title()} Agent: {response}")
        tcc_run_specialist.response(response)
        tcc_run_specialist.end()  # sends run to TCC
    except Exception as e:
        tcc_run_specialist.error(str(e))  # sends error run to TCC
        print(f"  {handoff_target.title()} Agent error: {e}")

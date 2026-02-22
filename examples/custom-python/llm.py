"""
LLM gateway — thin wrapper around LiteLLM.

In production this would point at a self-hosted LiteLLM proxy. Here we call
litellm.completion() directly, which routes to whatever provider the model
string maps to (OpenAI, Anthropic, etc.).
"""

import json
import litellm
from agents import AGENTS
from tools import execute_tool


def call_agent(agent_name: str, user_message: str) -> tuple[str, list[dict]]:
    """
    Run one agent turn: LLM call -> tool execution loop -> final response.

    Returns (response_text, tool_executions) where tool_executions is a list
    of {"tool": name, "args": {...}, "result": "..."} dicts.
    """
    agent = AGENTS[agent_name]
    messages = [
        {"role": "system", "content": agent["system_prompt"]},
        {"role": "user", "content": user_message},
    ]

    tool_executions = []

    # Agent loop — keep going until the model stops calling tools
    while True:
        kwargs = {
            "model": agent["model"],
            "messages": messages,
        }
        if agent.get("tools"):
            kwargs["tools"] = agent["tools"]
            kwargs["tool_choice"] = "auto"

        response = litellm.completion(**kwargs)
        assistant_msg = response.choices[0].message

        # No tool calls — we're done
        if not getattr(assistant_msg, "tool_calls", None):
            return assistant_msg.content or "", tool_executions

        # Process each tool call
        messages.append(assistant_msg)

        for tool_call in assistant_msg.tool_calls:
            fn_name = tool_call.function.name
            fn_args = json.loads(tool_call.function.arguments)

            # "handoff" is a framework-level signal, not a real tool
            if fn_name == "handoff":
                tool_executions.append({
                    "tool": "handoff",
                    "args": fn_args,
                    "result": json.dumps({"status": "routed", "agent": fn_args["agent"]}),
                })
                return assistant_msg.content or "", tool_executions

            result = execute_tool(fn_name, fn_args)
            tool_executions.append({"tool": fn_name, "args": fn_args, "result": result})

            messages.append({
                "tool_call_id": tool_call.id,
                "role": "tool",
                "name": fn_name,
                "content": result,
            })

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


def call_agent(agent_name: str, user_message: str, tcc_run) -> tuple[str, list[dict]]:
    """
    Run one agent turn: LLM call -> tool execution loop -> final response.

    Each LLM call is instrumented as a TCC step on the provided run.

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

        # Instrument this LLM call as a step
        step = tcc_run.step()
        step.prompt(json.dumps(messages))
        step.model(requested=agent["model"])
        if agent.get("tools"):
            step.tool_definitions(json.dumps(agent["tools"]))

        response = litellm.completion(**kwargs)
        assistant_msg = response.choices[0].message
        usage = response.usage

        # Finalize step with response data
        step.response(assistant_msg.content or "")
        step.model(used=response.model)
        step.finish_reason(response.choices[0].finish_reason or "unknown")
        step.tokens(
            prompt_uncached=usage.prompt_tokens,
            completion=usage.completion_tokens,
        )
        if hasattr(usage, "prompt_tokens_details") and usage.prompt_tokens_details:
            cached = getattr(usage.prompt_tokens_details, "cached_tokens", None)
            if cached is not None:
                step.tokens(prompt_cached=cached)
        step.end()

        # No tool calls — we're done
        if not getattr(assistant_msg, "tool_calls", None):
            return assistant_msg.content or "", tool_executions

        # Process each tool call
        messages.append(assistant_msg.model_dump())

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

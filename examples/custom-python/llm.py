"""
LLM gateway — thin wrapper around LiteLLM.

In production this would point at a self-hosted LiteLLM proxy. Here we call
litellm.completion() directly, which routes to whatever provider the model
string maps to (OpenAI, Anthropic, etc.).

TCC Instrumentation:
- Each litellm.completion() call is instrumented as a TCC step
- Each tool execution is instrumented as a TCC tool call
- Steps are created from the parent tcc_run passed in by the orchestrator
- Step captures: prompt, response, model info, token usage, tool definitions
- Tool call captures: tool name, args, result (or error)
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

        # =============================================================
        # TCC Step: instrument this LLM call
        # One step per litellm.completion() call within this agent turn
        # =============================================================
        tcc_step = tcc_run.step()
        tcc_step.prompt(json.dumps(messages))
        tcc_step.model(requested=agent["model"])
        if agent.get("tools"):
            tcc_step.tool_definitions(json.dumps(agent["tools"]))

        response = litellm.completion(**kwargs)
        assistant_msg = response.choices[0].message
        usage = response.usage

        # Finalize step with LLM response data
        tcc_step.response(assistant_msg.content or "")
        tcc_step.model(used=response.model)
        tcc_step.finish_reason(response.choices[0].finish_reason or "unknown")
        tcc_step.tokens(
            prompt_uncached=usage.prompt_tokens,
            completion=usage.completion_tokens,
        )
        if hasattr(usage, "prompt_tokens_details") and usage.prompt_tokens_details:
            cached = getattr(usage.prompt_tokens_details, "cached_tokens", None)
            if cached is not None:
                tcc_step.tokens(prompt_cached=cached)
        tcc_step.end()  # sends step to TCC

        # No tool calls — we're done
        if not getattr(assistant_msg, "tool_calls", None):
            return assistant_msg.content or "", tool_executions

        # Process each tool call, then loop back for another LLM call
        messages.append(assistant_msg.model_dump())

        for tool_call in assistant_msg.tool_calls:
            fn_name = tool_call.function.name
            fn_args = json.loads(tool_call.function.arguments)

            # =============================================================
            # TCC ToolCall: instrument this tool execution
            # =============================================================
            tcc_tc = tcc_run.tool_call(fn_name, tool_call_id=tool_call.id)
            tcc_tc.args(fn_args)

            # "handoff" is a framework-level signal, not a real tool
            if fn_name == "handoff":
                handoff_result = json.dumps({"status": "routed", "agent": fn_args["agent"]})
                tcc_tc.result(handoff_result).end()
                tool_executions.append({
                    "tool": "handoff",
                    "args": fn_args,
                    "result": handoff_result,
                })
                return assistant_msg.content or "", tool_executions

            try:
                result = execute_tool(fn_name, fn_args)
                tcc_tc.result(result).end()
            except Exception as e:
                tcc_tc.error(str(e))
                raise

            tool_executions.append({"tool": fn_name, "args": fn_args, "result": result})

            messages.append({
                "tool_call_id": tool_call.id,
                "role": "tool",
                "name": fn_name,
                "content": result,
            })

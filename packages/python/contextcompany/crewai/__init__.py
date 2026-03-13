"""CrewAI framework instrumentation for The Context Company.

Captures LLM calls and tool executions from CrewAI workflows.

Usage:
    from contextcompany.crewai import instrument_crewai, set_run_metadata
    import contextcompany as tcc

    instrument_crewai()

    r = tcc.run()
    r.prompt("What's the weather in Tampa?")

    set_run_metadata({"tcc.runId": r.run_id, "tcc.sessionId": "sess-1"})
    result = crew.kickoff()

    r.response(result.raw)
    r.end()
"""

import uuid
import threading
from typing import Any, Dict, Optional

from wrapt import wrap_function_wrapper

from .._utils import _debug


_run_id: Optional[str] = None
_pending_tool_calls: Dict[int, Any] = {}
_pending_lock = threading.Lock()


def set_run_metadata(metadata: Dict[str, Any]) -> None:
    """Set metadata for the next crew run.

    Call before ``crew.kickoff()``. The run_id is used for every
    LLM call and tool call that CrewAI makes internally.

    If ``tcc.runId`` is not provided, one is auto-generated.

    Args:
        metadata: Dict with optional ``tcc.runId``, ``tcc.sessionId``,
            and any custom key/value pairs.
    """
    global _run_id
    _run_id = metadata.get("tcc.runId") or str(uuid.uuid4())


def _get_run_id() -> str:
    """Get current run_id, auto-generating if needed."""
    global _run_id
    if not _run_id:
        _run_id = str(uuid.uuid4())
    return _run_id


def _wrap_llm_call(wrapped, instance, args, kwargs):
    """Capture LLM call data and send as a step.

    Wraps crewai.utilities.agent_utils.get_llm_response.
    """
    from ..step import Step
    import json

    run_id = _get_run_id()

    llm = args[0] if len(args) > 0 else kwargs.get("llm")
    messages = args[1] if len(args) > 1 else kwargs.get("messages", [])
    tools = kwargs.get("tools")

    # Snapshot token usage before the call
    token_usage_before = dict(getattr(llm, "_token_usage", {}))

    s = Step(run_id=run_id)

    # Format messages as JSON if possible
    try:
        s.prompt(json.dumps(messages))
    except (TypeError, ValueError):
        s.prompt(str(messages))

    model = getattr(llm, "model", None) or getattr(llm, "model_name", "unknown")
    s.model(requested=str(model), used=str(model))

    # Record tool definitions if present
    if tools:
        try:
            s.tool_definitions(json.dumps(tools))
        except (TypeError, ValueError):
            pass

    try:
        result = wrapped(*args, **kwargs)
    except Exception as e:
        s.error(status_message=str(e))
        raise

    # Extract per-call token usage by diffing before/after
    token_usage_after = dict(getattr(llm, "_token_usage", {}))
    prompt_tokens = token_usage_after.get("prompt_tokens", 0) - token_usage_before.get("prompt_tokens", 0)
    completion_tokens = token_usage_after.get("completion_tokens", 0) - token_usage_before.get("completion_tokens", 0)
    cached_tokens = token_usage_after.get("cached_prompt_tokens", 0) - token_usage_before.get("cached_prompt_tokens", 0)

    if prompt_tokens > 0 or completion_tokens > 0:
        s.tokens(
            prompt_uncached=prompt_tokens - cached_tokens,
            prompt_cached=cached_tokens,
            completion=completion_tokens,
        )

    # Format response
    if isinstance(result, str):
        s.response(result)
    elif isinstance(result, list):
        # Tool call responses — serialize them
        try:
            s.response(json.dumps([
                {"id": tc.id, "function": {"name": tc.function.name, "arguments": tc.function.arguments}}
                for tc in result if hasattr(tc, "function")
            ]))
            s.finish_reason("tool_calls")
        except (TypeError, ValueError, AttributeError):
            s.response(str(result))
            s.finish_reason("stop")
    else:
        s.response(str(result))
        s.finish_reason("stop")

    if not s._finish_reason:
        s.finish_reason("stop")

    s.end()
    _debug(f"Captured LLM step for run {run_id}")

    return result


def _before_tool_call_hook(context):
    """Capture tool call start."""
    from ..tool_call import ToolCall

    run_id = _get_run_id()
    tc = ToolCall(run_id=run_id, tool_name=context.tool_name)
    if context.tool_input:
        tc.args(context.tool_input)

    key = id(context.tool_input)
    with _pending_lock:
        _pending_tool_calls[key] = tc
    return None


def _after_tool_call_hook(context):
    """Capture tool call end."""
    key = id(context.tool_input)
    with _pending_lock:
        tc = _pending_tool_calls.pop(key, None)

    if tc is None:
        # Fallback: create a new ToolCall if before hook wasn't matched
        from ..tool_call import ToolCall
        tc = ToolCall(run_id=_get_run_id(), tool_name=context.tool_name)
        if context.tool_input:
            tc.args(context.tool_input)

    if context.tool_result:
        tc.result(context.tool_result)
    tc.end()
    return None


def instrument_crewai(
    api_key: Optional[str] = None,
    tcc_url: Optional[str] = None,
) -> None:
    """Instrument CrewAI for automatic observability.

    Sets up:
    - Patch on get_llm_response to capture every LLM call (model, prompts, responses)
    - CrewAI tool hooks to capture every tool execution (name, args, result, timing)

    Call once at startup, before creating any CrewAI objects.

    Args:
        api_key: TCC API key. Falls back to ``TCC_API_KEY`` env var.
        tcc_url: Override TCC endpoint URL. Falls back to ``TCC_URL`` env var.
    """
    from crewai.hooks import register_before_tool_call_hook, register_after_tool_call_hook

    _debug("Initializing CrewAI instrumentation")

    # 1. Patch get_llm_response — the single entry point for all LLM calls
    #    Also patch the cached import in crew_agent_executor.
    wrap_function_wrapper(
        "crewai.utilities.agent_utils", "get_llm_response", _wrap_llm_call
    )
    import crewai.agents.crew_agent_executor as _executor
    _executor.get_llm_response = __import__(
        "crewai.utilities.agent_utils", fromlist=["get_llm_response"]
    ).get_llm_response
    _debug("Patched get_llm_response")

    # 2. Register tool call hooks
    register_before_tool_call_hook(_before_tool_call_hook)
    register_after_tool_call_hook(_after_tool_call_hook)
    _debug("Registered CrewAI tool call hooks")

    _debug("CrewAI instrumentation initialized")


__all__ = ["instrument_crewai", "set_run_metadata"]

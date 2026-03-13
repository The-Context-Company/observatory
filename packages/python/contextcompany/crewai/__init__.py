"""CrewAI framework instrumentation for The Context Company.

Captures runs, LLM calls, and tool executions from CrewAI workflows.

Usage:
    from contextcompany.crewai import instrument_crewai, set_run_metadata

    instrument_crewai()

    # Optional: set session_id and custom metadata before kickoff
    set_run_metadata({"tcc.sessionId": "sess-1", "agentName": "weather-crew"})

    result = crew.kickoff()
    # Run, steps, and tool calls are all sent automatically.
"""

import uuid
import json
import threading
from typing import Any, Dict, Optional

from wrapt import wrap_function_wrapper

from .._utils import _debug


_run_id: Optional[str] = None
_metadata: Dict[str, Any] = {}
_pending_tool_calls: Dict[int, Any] = {}
_pending_lock = threading.Lock()


def set_run_metadata(metadata: Dict[str, Any]) -> None:
    """Set metadata for the next crew run.

    Call before ``crew.kickoff()``. Recognized keys:

    - ``tcc.runId``: Custom run ID (auto-generated if not provided).
    - ``tcc.sessionId``: Session ID to group related runs.
    - ``tcc.conversational``: Whether this is a conversational run.

    All other keys are sent as custom metadata.

    Example::

        set_run_metadata({
            "tcc.sessionId": session_id,
            "agentName": "weather-crew",
            "environment": "production",
        })
        result = crew.kickoff()
    """
    global _run_id, _metadata
    _run_id = metadata.get("tcc.runId") or str(uuid.uuid4())
    _metadata = metadata


def _get_run_id() -> str:
    """Get current run_id, auto-generating if needed."""
    global _run_id
    if not _run_id:
        _run_id = str(uuid.uuid4())
    return _run_id


def _wrap_kickoff(wrapped, instance, args, kwargs):
    """Wrap Crew.kickoff to automatically create and send a run."""
    from ..run import Run

    global _run_id
    run_id = _get_run_id()

    # Extract the user prompt from the crew's task descriptions
    task_descriptions = []
    for task in getattr(instance, "tasks", []):
        desc = getattr(task, "description", None)
        if desc:
            task_descriptions.append(desc)
    prompt = "\n\n".join(task_descriptions) if task_descriptions else ""

    # Build the Run
    r = Run(
        run_id=run_id,
        session_id=_metadata.get("tcc.sessionId"),
        conversational=_metadata.get("tcc.conversational"),
    )
    r.prompt(prompt)

    # Attach custom metadata (everything except tcc.* keys)
    custom_meta = {
        k: v for k, v in _metadata.items()
        if not k.startswith("tcc.")
    }
    if custom_meta:
        r.metadata(custom_meta)

    try:
        result = wrapped(*args, **kwargs)
    except Exception as e:
        r.error(status_message=str(e))
        # Reset for next run
        _run_id = None
        _metadata.clear()
        raise

    # Set response from crew output
    raw = getattr(result, "raw", None) or str(result)
    r.response(raw)
    r.end()

    _debug(f"Captured run {run_id}")

    # Reset for next run
    _run_id = None
    _metadata.clear()

    return result


def _wrap_llm_call(wrapped, instance, args, kwargs):
    """Capture LLM call data and send as a step.

    Wraps crewai.utilities.agent_utils.get_llm_response.
    """
    from ..step import Step

    run_id = _get_run_id()

    llm = args[0] if len(args) > 0 else kwargs.get("llm")
    messages = args[1] if len(args) > 1 else kwargs.get("messages", [])
    tools = kwargs.get("tools")

    # Snapshot token usage before the call
    token_usage_before = dict(getattr(llm, "_token_usage", {}))

    s = Step(run_id=run_id)

    try:
        s.prompt(json.dumps(messages))
    except (TypeError, ValueError):
        s.prompt(str(messages))

    model = getattr(llm, "model", None) or getattr(llm, "model_name", "unknown")
    s.model(requested=str(model), used=str(model))

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

    if isinstance(result, str):
        s.response(result)
    elif isinstance(result, list):
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

    After calling this, every ``crew.kickoff()`` automatically sends:
    - A **run** with the task description as prompt and crew output as response
    - A **step** for each LLM call (with model, tokens, messages)
    - A **tool call** for each tool execution (with name, args, result, timing)

    Call once at startup, before creating any CrewAI objects.

    Args:
        api_key: TCC API key. Falls back to ``TCC_API_KEY`` env var.
        tcc_url: Override TCC endpoint URL. Falls back to ``TCC_URL`` env var.
    """
    from crewai.hooks import register_before_tool_call_hook, register_after_tool_call_hook

    _debug("Initializing CrewAI instrumentation")

    # 1. Patch Crew.kickoff to auto-create runs
    wrap_function_wrapper("crewai.crew", "Crew.kickoff", _wrap_kickoff)
    _debug("Patched Crew.kickoff")

    # 2. Patch get_llm_response for LLM step capture
    wrap_function_wrapper(
        "crewai.utilities.agent_utils", "get_llm_response", _wrap_llm_call
    )
    import crewai.agents.crew_agent_executor as _executor
    _executor.get_llm_response = __import__(
        "crewai.utilities.agent_utils", fromlist=["get_llm_response"]
    ).get_llm_response
    _debug("Patched get_llm_response")

    # 3. Register tool call hooks
    register_before_tool_call_hook(_before_tool_call_hook)
    register_after_tool_call_hook(_after_tool_call_hook)
    _debug("Registered CrewAI tool call hooks")

    _debug("CrewAI instrumentation initialized")


__all__ = ["instrument_crewai", "set_run_metadata"]

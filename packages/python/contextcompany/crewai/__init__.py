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

from .._utils import _debug, _now_iso

# ── State ────────────────────────────────────────────────────────────

_next_metadata: Dict[str, Any] = {}
_next_lock = threading.Lock()
_pending_tool_calls: Dict[int, Any] = {}
_pending_tool_lock = threading.Lock()


def set_run_metadata(metadata: Dict[str, Any]) -> None:
    """Set metadata for the next crew run.

    Call before ``crew.kickoff()``. Recognized keys:

    - ``tcc.runId``: Custom run ID (auto-generated if not provided).
    - ``tcc.sessionId``: Session ID to group related runs.
    - ``tcc.conversational``: Whether this is a conversational run.

    All other keys are sent as custom metadata on the run.

    Example::

        set_run_metadata({
            "tcc.sessionId": session_id,
            "agentName": "weather-crew",
            "environment": "production",
        })
        result = crew.kickoff()
    """
    with _next_lock:
        _next_metadata.clear()
        _next_metadata.update(metadata)


def _read_metadata() -> Dict[str, Any]:
    """Read the metadata set by set_run_metadata (does not clear it).

    Metadata persists across kickoffs so kickoff_for_each works.
    The user clears it by calling set_run_metadata again.
    """
    with _next_lock:
        return dict(_next_metadata)


# ── Kickoff wrapper ──────────────────────────────────────────────────

def _wrap_kickoff(wrapped, instance, args, kwargs):
    """Wrap Crew.kickoff to automatically create and send a run."""
    from ..run import Run

    # Skip if this crew is already being traced (recursive streaming call)
    if getattr(instance, "_tcc_run_id", None):
        return wrapped(*args, **kwargs)

    meta = _read_metadata()
    run_id = meta.pop("tcc.runId", None) or str(uuid.uuid4())

    # Store on the crew instance so steps and tool calls can find it
    instance._tcc_run_id = run_id

    # Build the prompt from task descriptions
    task_descriptions = []
    for task in getattr(instance, "tasks", []):
        desc = getattr(task, "description", None)
        if desc:
            task_descriptions.append(desc)
    prompt = "\n\n".join(task_descriptions) if task_descriptions else ""

    r = Run(
        run_id=run_id,
        session_id=meta.get("tcc.sessionId"),
        conversational=meta.get("tcc.conversational"),
    )
    r.prompt(prompt)

    custom_meta = {
        k: v for k, v in meta.items()
        if not k.startswith("tcc.")
    }
    if custom_meta:
        r.metadata(custom_meta)

    try:
        result = wrapped(*args, **kwargs)
    except Exception as e:
        try:
            r.error(status_message=str(e))
        except Exception:
            pass
        instance._tcc_run_id = None
        raise

    _finalize_run(r, result, run_id)
    instance._tcc_run_id = None
    return result


def _finalize_run(r, result, run_id):
    """Send the run with the result."""
    try:
        raw = getattr(result, "raw", None) or str(result)
        r.response(raw)
        r.end()
        _debug(f"Captured run {run_id}")
    except Exception as e:
        _debug(f"Failed to send run: {e}")


async def _wrap_kickoff_async(wrapped, instance, args, kwargs):
    """Async wrapper for Crew.akickoff."""
    from ..run import Run

    if getattr(instance, "_tcc_run_id", None):
        return await wrapped(*args, **kwargs)

    meta = _read_metadata()
    run_id = meta.pop("tcc.runId", None) or str(uuid.uuid4())
    instance._tcc_run_id = run_id

    task_descriptions = []
    for task in getattr(instance, "tasks", []):
        desc = getattr(task, "description", None)
        if desc:
            task_descriptions.append(desc)
    prompt = "\n\n".join(task_descriptions) if task_descriptions else ""

    r = Run(
        run_id=run_id,
        session_id=meta.get("tcc.sessionId"),
        conversational=meta.get("tcc.conversational"),
    )
    r.prompt(prompt)

    custom_meta = {k: v for k, v in meta.items() if not k.startswith("tcc.")}
    if custom_meta:
        r.metadata(custom_meta)

    try:
        result = await wrapped(*args, **kwargs)
    except Exception as e:
        try:
            r.error(status_message=str(e))
        except Exception:
            pass
        instance._tcc_run_id = None
        raise

    _finalize_run(r, result, run_id)
    instance._tcc_run_id = None
    return result


# ── LLM call wrapper ─────────────────────────────────────────────────

def _get_run_id_from_llm_call(args, kwargs) -> Optional[str]:
    """Extract run_id from the agent→crew chain in get_llm_response args."""
    # Try kwargs first (reliable regardless of signature changes)
    for key in ("from_agent", "executor_context"):
        obj = kwargs.get(key)
        if obj:
            crew = getattr(obj, "crew", None)
            if crew:
                run_id = getattr(crew, "_tcc_run_id", None)
                if run_id:
                    return run_id

    # Fallback: scan positional args for anything with a .crew attribute
    for arg in args:
        crew = getattr(arg, "crew", None)
        if crew:
            run_id = getattr(crew, "_tcc_run_id", None)
            if run_id:
                return run_id

    return None


def _wrap_llm_call(wrapped, instance, args, kwargs):
    """Capture LLM call data and send as a step."""
    from ..step import Step

    # Prepare capture state before the call
    try:
        run_id = _get_run_id_from_llm_call(args, kwargs)
        if not run_id:
            return wrapped(*args, **kwargs)
        llm = args[0] if len(args) > 0 else kwargs.get("llm")
        messages = args[1] if len(args) > 1 else kwargs.get("messages", [])
        tools = kwargs.get("tools")
        token_usage_before = dict(getattr(llm, "_token_usage", {}))
        start_time = _now_iso()
    except Exception:
        return wrapped(*args, **kwargs)

    # Call the original
    try:
        result = wrapped(*args, **kwargs)
    except Exception as e:
        try:
            s = Step(run_id=run_id)
            s._start_time = start_time
            s.prompt(json.dumps(messages) if isinstance(messages, list) else str(messages))
            model = getattr(llm, "model", None) or "unknown"
            s.model(requested=str(model))
            s.error(status_message=str(e))
        except Exception:
            pass
        raise

    # Capture the step
    try:
        s = Step(run_id=run_id)
        s._start_time = start_time

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

        # Per-call token usage via diff
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
            s.finish_reason("stop")
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

        s.end()
        _debug(f"Captured LLM step for run {run_id}")
    except Exception as e:
        _debug(f"Failed to capture LLM step: {e}")

    return result


# ── Tool call hooks ──────────────────────────────────────────────────

def _before_tool_call_hook(context):
    """Capture tool call start."""
    try:
        from ..tool_call import ToolCall

        crew = getattr(context, "crew", None)
        run_id = getattr(crew, "_tcc_run_id", None) if crew else None
        if not run_id:
            return None

        tc = ToolCall(run_id=run_id, tool_name=context.tool_name)
        if context.tool_input:
            tc.args(context.tool_input)

        key = id(context.tool_input)
        with _pending_tool_lock:
            _pending_tool_calls[key] = tc
    except Exception as e:
        _debug(f"Failed in before_tool_call hook: {e}")
    return None


def _after_tool_call_hook(context):
    """Capture tool call end."""
    try:
        key = id(context.tool_input)
        with _pending_tool_lock:
            tc = _pending_tool_calls.pop(key, None)

        if tc is None:
            from ..tool_call import ToolCall
            crew = getattr(context, "crew", None)
            run_id = getattr(crew, "_tcc_run_id", None) if crew else None
            if not run_id:
                return None
            tc = ToolCall(run_id=run_id, tool_name=context.tool_name)
            if context.tool_input:
                tc.args(context.tool_input)

        if context.tool_result:
            tc.result(context.tool_result)
        tc.end()
    except Exception as e:
        _debug(f"Failed in after_tool_call hook: {e}")
    return None


# ── Patch helpers ────────────────────────────────────────────────────

def _patch_cached_import(module_path: str, attr_name: str, source_module: str) -> None:
    """Patch a cached `from X import Y` reference on a target module."""
    try:
        import importlib
        target = importlib.import_module(module_path)
        source = importlib.import_module(source_module)
        setattr(target, attr_name, getattr(source, attr_name))
    except Exception:
        pass


# ── Public API ───────────────────────────────────────────────────────

def instrument_crewai(
    api_key: Optional[str] = None,
    tcc_url: Optional[str] = None,
) -> None:
    """Instrument CrewAI for automatic observability.

    After calling this, every ``crew.kickoff()`` automatically sends:
    - A **run** with the task description as prompt and crew output as response
    - A **step** for each LLM call (with model, tokens, messages, timing)
    - A **tool call** for each tool execution (with name, args, result, timing)

    Call once at startup, before creating any CrewAI objects.

    Args:
        api_key: TCC API key. Falls back to ``TCC_API_KEY`` env var.
        tcc_url: Override TCC endpoint URL. Falls back to ``TCC_URL`` env var.
    """
    from crewai.hooks import register_before_tool_call_hook, register_after_tool_call_hook

    _debug("Initializing CrewAI instrumentation")

    # 1. Patch Crew.kickoff variants
    #    kickoff — sync entry point (also called by kickoff_async via asyncio.to_thread)
    #    akickoff — native async entry point (needs async wrapper)
    #    kickoff_for_each — calls kickoff per input, so already covered
    wrap_function_wrapper("crewai.crew", "Crew.kickoff", _wrap_kickoff)
    wrap_function_wrapper("crewai.crew", "Crew.akickoff", _wrap_kickoff_async)
    _debug("Patched Crew.kickoff and Crew.akickoff")

    # 2. Patch get_llm_response for LLM step capture
    wrap_function_wrapper(
        "crewai.utilities.agent_utils", "get_llm_response", _wrap_llm_call
    )
    _patch_cached_import("crewai.agents.crew_agent_executor", "get_llm_response", "crewai.utilities.agent_utils")
    _patch_cached_import("crewai.experimental.agent_executor", "get_llm_response", "crewai.utilities.agent_utils")
    _patch_cached_import("crewai.lite_agent", "get_llm_response", "crewai.utilities.agent_utils")
    _debug("Patched get_llm_response")

    # 3. Register tool call hooks
    register_before_tool_call_hook(_before_tool_call_hook)
    register_after_tool_call_hook(_after_tool_call_hook)
    _debug("Registered CrewAI tool call hooks")

    _debug("CrewAI instrumentation initialized")


__all__ = ["instrument_crewai", "set_run_metadata"]

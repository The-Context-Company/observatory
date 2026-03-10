"""Monkey-patching wrappers for Agno framework classes.

Wraps Agent, Team, Model, and FunctionCall to automatically capture
Run/Step/ToolCall data and send it to The Context Company.
"""

import uuid
from typing import Any, Optional

from .._utils import _debug, _now_iso, _send_payload
from ._context import get_current_run_id, reset_current_run_id, set_current_run_id
from ._extractors import (
    extract_response_content,
    extract_run_metadata,
    extract_run_metrics,
    extract_step_data,
    extract_streaming_run_data,
    extract_streaming_step_data,
    extract_system_prompt,
    extract_tool_data,
    extract_user_prompt,
    _safe_json,
    _safe_str,
)

_patched = False


def _is_patched() -> bool:
    return _patched


def _send_run_payload(
    run_id: str,
    start_time: str,
    user_prompt: str,
    system_prompt: Optional[str],
    response: str,
    status_code: int,
    session_id: Optional[str],
    metadata: Optional[dict],
    token_metrics: Optional[dict],
    api_key: Optional[str],
    tcc_url: Optional[str],
    status_message: Optional[str] = None,
) -> None:
    prompt_obj: dict = {"user_prompt": user_prompt}
    if system_prompt:
        prompt_obj["system_prompt"] = system_prompt

    payload: dict = {
        "type": "run",
        "run_id": run_id,
        "start_time": start_time,
        "end_time": _now_iso(),
        "prompt": prompt_obj,
        "status_code": status_code,
    }
    if response:
        payload["response"] = response
    if session_id:
        payload["session_id"] = session_id
    if metadata:
        payload["metadata"] = {k: str(v) for k, v in metadata.items()}
    if token_metrics:
        if token_metrics.get("prompt_uncached_tokens"):
            payload["prompt_uncached_tokens"] = token_metrics["prompt_uncached_tokens"]
        if token_metrics.get("prompt_cached_tokens"):
            payload["prompt_cached_tokens"] = token_metrics["prompt_cached_tokens"]
        if token_metrics.get("completion_tokens"):
            payload["completion_tokens"] = token_metrics["completion_tokens"]
    if status_message:
        payload["status_message"] = status_message

    _send_payload(payload, "agno run", api_key=api_key, tcc_url=tcc_url)


def _send_step_payload(
    run_id: str,
    step_id: str,
    start_time: str,
    step_data: dict,
    status_code: int,
    api_key: Optional[str],
    tcc_url: Optional[str],
    status_message: Optional[str] = None,
) -> None:
    payload: dict = {
        "type": "step",
        "run_id": run_id,
        "step_id": step_id,
        "start_time": start_time,
        "end_time": _now_iso(),
        "status_code": status_code,
    }
    payload["prompt"] = step_data.get("prompt", "")
    payload["response"] = step_data.get("response", "")
    if step_data.get("model_requested"):
        payload["model_requested"] = step_data["model_requested"]
    if step_data.get("model_used"):
        payload["model_used"] = step_data["model_used"]
    if step_data.get("finish_reason"):
        payload["finish_reason"] = step_data["finish_reason"]
    if step_data.get("prompt_uncached_tokens"):
        payload["prompt_uncached_tokens"] = step_data["prompt_uncached_tokens"]
    if step_data.get("prompt_cached_tokens"):
        payload["prompt_cached_tokens"] = step_data["prompt_cached_tokens"]
    if step_data.get("completion_tokens"):
        payload["completion_tokens"] = step_data["completion_tokens"]
    if step_data.get("tool_definitions"):
        payload["tool_definitions"] = step_data["tool_definitions"]
    if status_message:
        payload["status_message"] = status_message

    _send_payload(payload, "agno step", api_key=api_key, tcc_url=tcc_url)


def _send_tool_payload(
    run_id: str,
    tool_call_id: str,
    tool_name: str,
    start_time: str,
    status_code: int,
    args_str: Optional[str],
    result_str: Optional[str],
    api_key: Optional[str],
    tcc_url: Optional[str],
    status_message: Optional[str] = None,
) -> None:
    payload: dict = {
        "type": "tool_call",
        "run_id": run_id,
        "tool_call_id": tool_call_id,
        "tool_name": tool_name,
        "start_time": start_time,
        "end_time": _now_iso(),
        "status_code": status_code,
    }
    if args_str:
        payload["args"] = args_str
    if result_str:
        payload["result"] = result_str
    if status_message:
        payload["status_message"] = status_message

    _send_payload(payload, "agno tool_call", api_key=api_key, tcc_url=tcc_url)


# ---------------------------------------------------------------------------
# Agent / Team wrappers
# ---------------------------------------------------------------------------

def _make_run_wrapper(
    api_key: Optional[str], tcc_url: Optional[str], component: str
):
    """Create a sync wrapper for Agent.run or Team.run."""

    def wrapper(wrapped: Any, instance: Any, args: Any, kwargs: Any) -> Any:
        existing_run_id = get_current_run_id()
        if existing_run_id:
            return wrapped(*args, **kwargs)

        run_id = str(uuid.uuid4())
        start_time = _now_iso()
        token = set_current_run_id(run_id)

        _debug(f"Agno {component} run started: {run_id}")

        try:
            user_prompt = extract_user_prompt(args, kwargs)
            system_prompt = extract_system_prompt(instance)
            session_id = getattr(instance, "session_id", None)
            metadata = extract_run_metadata(instance)
        except Exception:
            user_prompt, system_prompt, session_id, metadata = "", None, None, {}

        try:
            result = wrapped(*args, **kwargs)
        except Exception as exc:
            try:
                _send_run_payload(
                    run_id=run_id,
                    start_time=start_time,
                    user_prompt=user_prompt,
                    system_prompt=system_prompt,
                    response="",
                    status_code=2,
                    session_id=session_id,
                    metadata=metadata,
                    token_metrics=None,
                    api_key=api_key,
                    tcc_url=tcc_url,
                    status_message=_safe_str(exc, 1000),
                )
            except Exception:
                pass
            raise
        finally:
            reset_current_run_id(token)

        # Check if result is a sync iterator/generator (streaming mode)
        if hasattr(result, "__iter__") and hasattr(result, "__next__"):
            return _wrap_sync_run_stream(
                result,
                run_id=run_id,
                start_time=start_time,
                user_prompt=user_prompt,
                system_prompt=system_prompt,
                session_id=session_id,
                metadata=metadata,
                api_key=api_key,
                tcc_url=tcc_url,
            )

        try:
            response = extract_response_content(result)
            run_metrics = extract_run_metrics(result)
            _send_run_payload(
                run_id=run_id,
                start_time=start_time,
                user_prompt=user_prompt,
                system_prompt=system_prompt,
                response=response,
                status_code=0,
                session_id=session_id,
                metadata=metadata,
                token_metrics=run_metrics,
                api_key=api_key,
                tcc_url=tcc_url,
            )
        except Exception:
            pass

        return result

    return wrapper


def _make_async_run_wrapper(
    api_key: Optional[str], tcc_url: Optional[str], component: str
):
    """Create an async wrapper for Agent.arun or Team.arun."""

    async def wrapper(wrapped: Any, instance: Any, args: Any, kwargs: Any) -> Any:
        existing_run_id = get_current_run_id()
        if existing_run_id:
            return await wrapped(*args, **kwargs)

        run_id = str(uuid.uuid4())
        start_time = _now_iso()
        token = set_current_run_id(run_id)

        _debug(f"Agno {component} async run started: {run_id}")

        try:
            user_prompt = extract_user_prompt(args, kwargs)
            system_prompt = extract_system_prompt(instance)
            session_id = getattr(instance, "session_id", None)
            metadata = extract_run_metadata(instance)
        except Exception:
            user_prompt, system_prompt, session_id, metadata = "", None, None, {}

        try:
            result = await wrapped(*args, **kwargs)
        except Exception as exc:
            try:
                _send_run_payload(
                    run_id=run_id,
                    start_time=start_time,
                    user_prompt=user_prompt,
                    system_prompt=system_prompt,
                    response="",
                    status_code=2,
                    session_id=session_id,
                    metadata=metadata,
                    token_metrics=None,
                    api_key=api_key,
                    tcc_url=tcc_url,
                    status_message=_safe_str(exc, 1000),
                )
            except Exception:
                pass
            raise
        finally:
            reset_current_run_id(token)

        # Check if result is an async iterator (streaming mode)
        if hasattr(result, "__aiter__") and hasattr(result, "__anext__"):
            return _wrap_async_run_stream(
                result,
                run_id=run_id,
                start_time=start_time,
                user_prompt=user_prompt,
                system_prompt=system_prompt,
                session_id=session_id,
                metadata=metadata,
                api_key=api_key,
                tcc_url=tcc_url,
            )

        try:
            response = extract_response_content(result)
            run_metrics = extract_run_metrics(result)
            _send_run_payload(
                run_id=run_id,
                start_time=start_time,
                user_prompt=user_prompt,
                system_prompt=system_prompt,
                response=response,
                status_code=0,
                session_id=session_id,
                metadata=metadata,
                token_metrics=run_metrics,
                api_key=api_key,
                tcc_url=tcc_url,
            )
        except Exception:
            pass

        return result

    return wrapper


def _wrap_sync_run_stream(
    iterator: Any,
    *,
    run_id: str,
    start_time: str,
    user_prompt: str,
    system_prompt: Optional[str],
    session_id: Optional[str],
    metadata: Optional[dict],
    api_key: Optional[str],
    tcc_url: Optional[str],
):
    """Wrap a sync streaming iterator to capture run data from event chunks."""
    chunks = []
    token = set_current_run_id(run_id)
    try:
        for chunk in iterator:
            chunks.append(chunk)
            yield chunk
    except Exception as exc:
        try:
            _send_run_payload(
                run_id=run_id,
                start_time=start_time,
                user_prompt=user_prompt,
                system_prompt=system_prompt,
                response="",
                status_code=2,
                session_id=session_id,
                metadata=metadata,
                token_metrics=None,
                api_key=api_key,
                tcc_url=tcc_url,
                status_message=_safe_str(exc, 1000),
            )
        except Exception:
            pass
        raise
    else:
        try:
            content, run_metrics = extract_streaming_run_data(chunks)
            _send_run_payload(
                run_id=run_id,
                start_time=start_time,
                user_prompt=user_prompt,
                system_prompt=system_prompt,
                response=content,
                status_code=0,
                session_id=session_id,
                metadata=metadata,
                token_metrics=run_metrics,
                api_key=api_key,
                tcc_url=tcc_url,
            )
        except Exception:
            pass
    finally:
        reset_current_run_id(token)


async def _wrap_async_run_stream(
    aiterator: Any,
    *,
    run_id: str,
    start_time: str,
    user_prompt: str,
    system_prompt: Optional[str],
    session_id: Optional[str],
    metadata: Optional[dict],
    api_key: Optional[str],
    tcc_url: Optional[str],
):
    """Wrap an async streaming iterator to capture run data from event chunks."""
    chunks = []
    token = set_current_run_id(run_id)
    try:
        async for chunk in aiterator:
            chunks.append(chunk)
            yield chunk
    except Exception as exc:
        try:
            _send_run_payload(
                run_id=run_id,
                start_time=start_time,
                user_prompt=user_prompt,
                system_prompt=system_prompt,
                response="",
                status_code=2,
                session_id=session_id,
                metadata=metadata,
                token_metrics=None,
                api_key=api_key,
                tcc_url=tcc_url,
                status_message=_safe_str(exc, 1000),
            )
        except Exception:
            pass
        raise
    else:
        try:
            content, run_metrics = extract_streaming_run_data(chunks)
            _send_run_payload(
                run_id=run_id,
                start_time=start_time,
                user_prompt=user_prompt,
                system_prompt=system_prompt,
                response=content,
                status_code=0,
                session_id=session_id,
                metadata=metadata,
                token_metrics=run_metrics,
                api_key=api_key,
                tcc_url=tcc_url,
            )
        except Exception:
            pass
    finally:
        reset_current_run_id(token)


# ---------------------------------------------------------------------------
# Model wrappers (→ Steps)
# ---------------------------------------------------------------------------

def _make_model_wrapper(api_key: Optional[str], tcc_url: Optional[str]):
    """Create a sync wrapper for Model.invoke / Model.response."""

    def wrapper(wrapped: Any, instance: Any, args: Any, kwargs: Any) -> Any:
        run_id = get_current_run_id()
        if not run_id:
            return wrapped(*args, **kwargs)

        step_id = str(uuid.uuid4())
        start_time = _now_iso()

        try:
            result = wrapped(*args, **kwargs)
        except Exception as exc:
            try:
                _send_step_payload(
                    run_id=run_id,
                    step_id=step_id,
                    start_time=start_time,
                    step_data={"prompt": "", "response": ""},
                    status_code=2,
                    api_key=api_key,
                    tcc_url=tcc_url,
                    status_message=_safe_str(exc, 1000),
                )
            except Exception:
                pass
            raise

        try:
            step_data = extract_step_data(instance, args, kwargs, result)
            _send_step_payload(
                run_id=run_id,
                step_id=step_id,
                start_time=start_time,
                step_data=step_data,
                status_code=0,
                api_key=api_key,
                tcc_url=tcc_url,
            )
        except Exception:
            pass

        return result

    return wrapper


def _make_async_model_wrapper(api_key: Optional[str], tcc_url: Optional[str]):
    """Create an async wrapper for Model.ainvoke / Model.aresponse."""

    async def wrapper(wrapped: Any, instance: Any, args: Any, kwargs: Any) -> Any:
        run_id = get_current_run_id()
        if not run_id:
            return await wrapped(*args, **kwargs)

        step_id = str(uuid.uuid4())
        start_time = _now_iso()

        try:
            result = await wrapped(*args, **kwargs)
        except Exception as exc:
            try:
                _send_step_payload(
                    run_id=run_id,
                    step_id=step_id,
                    start_time=start_time,
                    step_data={"prompt": "", "response": ""},
                    status_code=2,
                    api_key=api_key,
                    tcc_url=tcc_url,
                    status_message=_safe_str(exc, 1000),
                )
            except Exception:
                pass
            raise

        try:
            step_data = extract_step_data(instance, args, kwargs, result)
            _send_step_payload(
                run_id=run_id,
                step_id=step_id,
                start_time=start_time,
                step_data=step_data,
                status_code=0,
                api_key=api_key,
                tcc_url=tcc_url,
            )
        except Exception:
            pass

        return result

    return wrapper


def _make_model_stream_wrapper(api_key: Optional[str], tcc_url: Optional[str]):
    """Create a sync wrapper for Model.invoke_stream / Model.response_stream."""

    def wrapper(wrapped: Any, instance: Any, args: Any, kwargs: Any) -> Any:
        run_id = get_current_run_id()
        if not run_id:
            return wrapped(*args, **kwargs)

        step_id = str(uuid.uuid4())
        start_time = _now_iso()

        def _traced():
            chunks = []
            try:
                for chunk in wrapped(*args, **kwargs):
                    chunks.append(chunk)
                    yield chunk
            except Exception as exc:
                try:
                    _send_step_payload(
                        run_id=run_id,
                        step_id=step_id,
                        start_time=start_time,
                        step_data={"prompt": "", "response": ""},
                        status_code=2,
                        api_key=api_key,
                        tcc_url=tcc_url,
                        status_message=_safe_str(exc, 1000),
                    )
                except Exception:
                    pass
                raise
            else:
                try:
                    step_data = extract_streaming_step_data(
                        instance, args, kwargs, chunks
                    )
                    _send_step_payload(
                        run_id=run_id,
                        step_id=step_id,
                        start_time=start_time,
                        step_data=step_data,
                        status_code=0,
                        api_key=api_key,
                        tcc_url=tcc_url,
                    )
                except Exception:
                    pass

        return _traced()

    return wrapper


def _make_async_model_stream_wrapper(
    api_key: Optional[str], tcc_url: Optional[str]
):
    """Create an async wrapper for Model.ainvoke_stream / Model.aresponse_stream."""

    def wrapper(wrapped: Any, instance: Any, args: Any, kwargs: Any) -> Any:
        run_id = get_current_run_id()
        if not run_id:
            return wrapped(*args, **kwargs)

        step_id = str(uuid.uuid4())
        start_time = _now_iso()

        async def _traced():
            chunks = []
            try:
                async for chunk in wrapped(*args, **kwargs):
                    chunks.append(chunk)
                    yield chunk
            except Exception as exc:
                try:
                    _send_step_payload(
                        run_id=run_id,
                        step_id=step_id,
                        start_time=start_time,
                        step_data={"prompt": "", "response": ""},
                        status_code=2,
                        api_key=api_key,
                        tcc_url=tcc_url,
                        status_message=_safe_str(exc, 1000),
                    )
                except Exception:
                    pass
                raise
            else:
                try:
                    step_data = extract_streaming_step_data(
                        instance, args, kwargs, chunks
                    )
                    _send_step_payload(
                        run_id=run_id,
                        step_id=step_id,
                        start_time=start_time,
                        step_data=step_data,
                        status_code=0,
                        api_key=api_key,
                        tcc_url=tcc_url,
                    )
                except Exception:
                    pass

        return _traced()

    return wrapper


# ---------------------------------------------------------------------------
# FunctionCall wrappers (→ ToolCalls)
# ---------------------------------------------------------------------------

def _make_tool_wrapper(api_key: Optional[str], tcc_url: Optional[str]):
    """Create a sync wrapper for FunctionCall.execute."""

    def wrapper(wrapped: Any, instance: Any, args: Any, kwargs: Any) -> Any:
        run_id = get_current_run_id()
        if not run_id:
            return wrapped(*args, **kwargs)

        tool_call_id = str(uuid.uuid4())
        start_time = _now_iso()

        try:
            tool_name, args_str = extract_tool_data(instance)
        except Exception:
            tool_name, args_str = "unknown", None

        try:
            result = wrapped(*args, **kwargs)
        except Exception as exc:
            try:
                _send_tool_payload(
                    run_id=run_id,
                    tool_call_id=tool_call_id,
                    tool_name=tool_name,
                    start_time=start_time,
                    status_code=2,
                    args_str=args_str,
                    result_str=None,
                    api_key=api_key,
                    tcc_url=tcc_url,
                    status_message=_safe_str(exc, 1000),
                )
            except Exception:
                pass
            raise

        try:
            result_str = _safe_json(result)
            _send_tool_payload(
                run_id=run_id,
                tool_call_id=tool_call_id,
                tool_name=tool_name,
                start_time=start_time,
                status_code=0,
                args_str=args_str,
                result_str=result_str,
                api_key=api_key,
                tcc_url=tcc_url,
            )
        except Exception:
            pass

        return result

    return wrapper


def _make_async_tool_wrapper(api_key: Optional[str], tcc_url: Optional[str]):
    """Create an async wrapper for FunctionCall.aexecute."""

    async def wrapper(wrapped: Any, instance: Any, args: Any, kwargs: Any) -> Any:
        run_id = get_current_run_id()
        if not run_id:
            return await wrapped(*args, **kwargs)

        tool_call_id = str(uuid.uuid4())
        start_time = _now_iso()

        try:
            tool_name, args_str = extract_tool_data(instance)
        except Exception:
            tool_name, args_str = "unknown", None

        try:
            result = await wrapped(*args, **kwargs)
        except Exception as exc:
            try:
                _send_tool_payload(
                    run_id=run_id,
                    tool_call_id=tool_call_id,
                    tool_name=tool_name,
                    start_time=start_time,
                    status_code=2,
                    args_str=args_str,
                    result_str=None,
                    api_key=api_key,
                    tcc_url=tcc_url,
                    status_message=_safe_str(exc, 1000),
                )
            except Exception:
                pass
            raise

        try:
            result_str = _safe_json(result)
            _send_tool_payload(
                run_id=run_id,
                tool_call_id=tool_call_id,
                tool_name=tool_name,
                start_time=start_time,
                status_code=0,
                args_str=args_str,
                result_str=result_str,
                api_key=api_key,
                tcc_url=tcc_url,
            )
        except Exception:
            pass

        return result

    return wrapper


# ---------------------------------------------------------------------------
# Patch orchestrator
# ---------------------------------------------------------------------------

def _safe_wrap(module_path: str, attr: str, wrapper: Any) -> None:
    """Wrap a method if it exists, silently skip otherwise."""
    from wrapt import wrap_function_wrapper
    try:
        wrap_function_wrapper(module_path, attr, wrapper)
        _debug(f"Patched {module_path}.{attr}")
    except Exception as exc:
        _debug(f"Could not patch {module_path}.{attr}: {exc}")


def patch_all(api_key: Optional[str] = None, tcc_url: Optional[str] = None) -> None:
    """Apply all Agno monkey-patches."""
    global _patched
    if _patched:
        _debug("Agno already instrumented, skipping")
        return

    run_wrapper = _make_run_wrapper(api_key, tcc_url, "Agent")
    async_run_wrapper = _make_async_run_wrapper(api_key, tcc_url, "Agent")
    team_run_wrapper = _make_run_wrapper(api_key, tcc_url, "Team")
    team_async_run_wrapper = _make_async_run_wrapper(api_key, tcc_url, "Team")

    model_wrapper = _make_model_wrapper(api_key, tcc_url)
    async_model_wrapper = _make_async_model_wrapper(api_key, tcc_url)
    model_stream_wrapper = _make_model_stream_wrapper(api_key, tcc_url)
    async_model_stream_wrapper = _make_async_model_stream_wrapper(api_key, tcc_url)

    tool_wrapper = _make_tool_wrapper(api_key, tcc_url)
    async_tool_wrapper = _make_async_tool_wrapper(api_key, tcc_url)

    # --- Agent ---
    _safe_wrap("agno.agent.agent", "Agent.run", run_wrapper)
    _safe_wrap("agno.agent.agent", "Agent.arun", async_run_wrapper)

    # --- Team ---
    _safe_wrap("agno.team.team", "Team.run", team_run_wrapper)
    _safe_wrap("agno.team.team", "Team.arun", team_async_run_wrapper)

    # --- Model (non-streaming) ---
    _safe_wrap("agno.models.base", "Model.invoke", model_wrapper)
    _safe_wrap("agno.models.base", "Model.ainvoke", async_model_wrapper)
    _safe_wrap("agno.models.base", "Model.response", model_wrapper)
    _safe_wrap("agno.models.base", "Model.aresponse", async_model_wrapper)

    # --- Model (streaming) ---
    _safe_wrap("agno.models.base", "Model.invoke_stream", model_stream_wrapper)
    _safe_wrap("agno.models.base", "Model.ainvoke_stream", async_model_stream_wrapper)
    _safe_wrap("agno.models.base", "Model.response_stream", model_stream_wrapper)
    _safe_wrap("agno.models.base", "Model.aresponse_stream", async_model_stream_wrapper)

    # --- FunctionCall ---
    _safe_wrap("agno.tools.function", "FunctionCall.execute", tool_wrapper)
    _safe_wrap("agno.tools.function", "FunctionCall.aexecute", async_tool_wrapper)

    _patched = True
    _debug("Agno instrumentation complete")

"""Helpers to extract and serialize data from Agno framework objects."""

import json
from typing import Any, Dict, List, Optional, Tuple


def _try_model_dump(obj: Any) -> Any:
    """Convert a Pydantic model (or similar) to a dict."""
    if obj is None:
        return None
    if isinstance(obj, (str, int, float, bool)):
        return obj
    if isinstance(obj, dict):
        return obj
    if hasattr(obj, "model_dump") and callable(obj.model_dump):
        try:
            return obj.model_dump()
        except Exception:
            pass
    if hasattr(obj, "__dict__"):
        try:
            return obj.__dict__.copy()
        except Exception:
            pass
    return obj


def _safe_json(obj: Any, max_len: int = 100_000) -> str:
    """Serialize to JSON string, truncating if needed."""
    try:
        dumped = _try_model_dump(obj)
        s = json.dumps(dumped, default=str)
        return s[:max_len] if len(s) > max_len else s
    except Exception:
        s = str(obj)
        return s[:max_len] if len(s) > max_len else s


def _safe_str(obj: Any, max_len: int = 100_000) -> str:
    try:
        s = str(obj) if obj is not None else ""
        return s[:max_len] if len(s) > max_len else s
    except Exception:
        return ""


def extract_user_prompt(args: tuple, kwargs: dict) -> str:
    """Extract user prompt from Agent.run / Team.run arguments."""
    message = args[0] if args else kwargs.get("message")
    if message is None:
        return ""
    return _safe_str(message)


def extract_system_prompt(instance: Any) -> Optional[str]:
    """Extract system prompt from an Agent or Team instance."""
    for attr in ("system_prompt", "instructions", "description"):
        val = getattr(instance, attr, None)
        if val:
            return _safe_str(val)
    return None


def extract_response_content(result: Any) -> str:
    """Extract response content from an Agno RunOutput."""
    if result is None:
        return ""
    content = getattr(result, "content", None)
    if content is not None:
        return _safe_str(content)
    return _safe_str(result)


def extract_run_metadata(instance: Any) -> Dict[str, str]:
    """Extract metadata from an Agent or Team instance."""
    metadata: Dict[str, str] = {}
    name = getattr(instance, "name", None)
    if name:
        metadata["agent_name"] = str(name)
    agent_id = getattr(instance, "agent_id", None)
    if agent_id:
        metadata["agent_id"] = str(agent_id)
    model = getattr(instance, "model", None)
    if model:
        model_id = getattr(model, "id", None)
        if model_id:
            metadata["model"] = str(model_id)
        provider = getattr(model, "provider", None)
        if provider:
            metadata["provider"] = str(provider)
    return metadata


def extract_run_metrics(result: Any) -> Dict[str, Any]:
    """Extract token metrics from a RunOutput's metrics."""
    out: Dict[str, Any] = {}
    metrics = getattr(result, "metrics", None)
    if metrics is None:
        return out

    metrics_dict = _try_model_dump(metrics)
    if not isinstance(metrics_dict, dict):
        return out

    _sum_metric(metrics_dict, "input_tokens", out, "prompt_uncached_tokens")
    _sum_metric(metrics_dict, "output_tokens", out, "completion_tokens")
    _sum_metric(metrics_dict, "cache_read_tokens", out, "prompt_cached_tokens")

    return out


def extract_step_data(
    instance: Any, args: tuple, kwargs: dict, result: Any
) -> Dict[str, Any]:
    """Extract data for a Step payload from a Model invocation."""
    data: Dict[str, Any] = {}

    messages = _get_kwarg(args, kwargs, "messages", index=0)
    if messages:
        data["prompt"] = _serialize_messages(messages)

    model_id = getattr(instance, "id", None) or getattr(instance, "name", None)
    if model_id:
        data["model_requested"] = str(model_id)
        data["model_used"] = str(model_id)

    tools = kwargs.get("tools")
    if tools:
        data["tool_definitions"] = _safe_json(tools)

    if result is not None:
        content = getattr(result, "content", None)
        if content is not None:
            data["response"] = _safe_str(content)
        else:
            data["response"] = _safe_str(result)

        usage = getattr(result, "response_usage", None) or getattr(
            result, "usage", None
        )
        if usage:
            usage_dict = _try_model_dump(usage)
            if isinstance(usage_dict, dict):
                _sum_metric(
                    usage_dict, "input_tokens", data, "prompt_uncached_tokens"
                )
                _sum_metric(
                    usage_dict, "output_tokens", data, "completion_tokens"
                )
                _sum_metric(
                    usage_dict, "cache_read_tokens", data, "prompt_cached_tokens"
                )

        finish = getattr(result, "finish_reason", None)
        if finish:
            data["finish_reason"] = str(finish)

    return data


def extract_streaming_step_data(
    instance: Any,
    args: tuple,
    kwargs: dict,
    chunks: List[Any],
) -> Dict[str, Any]:
    """Extract step data from accumulated streaming chunks."""
    data: Dict[str, Any] = {}

    messages = _get_kwarg(args, kwargs, "messages", index=0)
    if messages:
        data["prompt"] = _serialize_messages(messages)

    model_id = getattr(instance, "id", None) or getattr(instance, "name", None)
    if model_id:
        data["model_requested"] = str(model_id)
        data["model_used"] = str(model_id)

    tools = kwargs.get("tools")
    if tools:
        data["tool_definitions"] = _safe_json(tools)

    content_parts: List[str] = []
    usage = None
    for chunk in chunks:
        c = getattr(chunk, "content", None)
        if c:
            content_parts.append(str(c))
        u = getattr(chunk, "response_usage", None) or getattr(chunk, "usage", None)
        if u:
            usage = u

    if content_parts:
        data["response"] = "".join(content_parts)

    if usage:
        usage_dict = _try_model_dump(usage)
        if isinstance(usage_dict, dict):
            _sum_metric(usage_dict, "input_tokens", data, "prompt_uncached_tokens")
            _sum_metric(usage_dict, "output_tokens", data, "completion_tokens")
            _sum_metric(
                usage_dict, "cache_read_tokens", data, "prompt_cached_tokens"
            )

    return data


def extract_streaming_run_data(chunks: List[Any]) -> Tuple[str, Dict[str, Any]]:
    """Extract run response content and metrics from streaming event chunks."""
    content_parts: List[str] = []
    token_metrics: Dict[str, Any] = {}

    for chunk in chunks:
        event = getattr(chunk, "event", None)
        if event == "RunContent" or event is None:
            c = getattr(chunk, "content", None)
            if c:
                content_parts.append(str(c))
        elif event == "RunCompleted":
            metrics = getattr(chunk, "metrics", None)
            if metrics:
                m = _try_model_dump(metrics)
                if isinstance(m, dict):
                    _sum_metric(m, "input_tokens", token_metrics, "prompt_uncached_tokens")
                    _sum_metric(m, "output_tokens", token_metrics, "completion_tokens")
                    _sum_metric(m, "cache_read_tokens", token_metrics, "prompt_cached_tokens")

    return "".join(content_parts), token_metrics


def extract_tool_data(instance: Any) -> Tuple[str, Optional[str]]:
    """Extract tool name and arguments from a FunctionCall instance."""
    tool_name = "unknown"
    func = getattr(instance, "function", None)
    if func:
        name = getattr(func, "name", None)
        if name:
            tool_name = str(name)

    arguments = getattr(instance, "arguments", None)
    args_str = _safe_json(arguments) if arguments else None

    return tool_name, args_str


def _serialize_messages(messages: Any) -> str:
    if isinstance(messages, list):
        serialized = []
        for msg in messages:
            dumped = _try_model_dump(msg)
            serialized.append(dumped)
        return json.dumps(serialized, default=str)
    return _safe_json(messages)


def _get_kwarg(args: tuple, kwargs: dict, name: str, index: int = 0) -> Any:
    if len(args) > index:
        return args[index]
    return kwargs.get(name)


def _sum_metric(
    source: dict, source_key: str, target: dict, target_key: str
) -> None:
    val = source.get(source_key)
    if val is None:
        return
    if isinstance(val, list):
        total = sum(v for v in val if isinstance(v, (int, float)))
        if total > 0:
            target[target_key] = int(total)
    elif isinstance(val, (int, float)) and val > 0:
        target[target_key] = int(val)

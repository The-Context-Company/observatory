"""Claude Agent SDK instrumentation for The Context Company.

Wraps the Claude Agent SDK's ``query()`` function to transparently collect
all streamed messages and send them to the TCC backend for observability.

The approach mirrors the TypeScript implementation in
``packages/ts/claude/src/claude.ts``:

1.  ``instrument_claude_agent()`` returns an :class:`InstrumentedClaudeAgent`
    whose ``query()`` method wraps ``claude_agent_sdk.query()``.
2.  Every message yielded by the underlying async iterator is serialised to a
    dict, timestamped with ``receivedAtMs``, and collected.
3.  The original message objects are yielded transparently so downstream code
    is unaffected.
4.  After the stream completes (or on error) the collected messages are
    POSTed to the ``/v1/claude`` endpoint.

Usage::

    from contextcompany.claude import instrument_claude_agent, TCCConfig
    from claude_agent_sdk import ClaudeAgentOptions, AssistantMessage, TextBlock

    agent = instrument_claude_agent()

    async for message in agent.query(
        prompt="What is 2 + 2?",
        options=ClaudeAgentOptions(system_prompt="You are helpful."),
        tcc_config=TCCConfig(run_id="my-run", session_id="my-session"),
    ):
        if isinstance(message, AssistantMessage):
            for block in message.content:
                if isinstance(block, TextBlock):
                    print(block.text)
"""

import asyncio
import contextvars
import dataclasses
import json
import os
import time
import uuid
from dataclasses import dataclass
from typing import Any, AsyncIterator, Dict, List, Optional

import requests

from ..config import get_api_key, get_url


# Per-call debug scope.  Using a ContextVar (not ``os.environ``) so concurrent
# ``query()`` calls can't corrupt each other's debug state — ContextVars are
# copy-on-write per asyncio Task, and ``asyncio.to_thread`` propagates them
# into the worker thread, so ``_debug`` calls from ``_send_to_tcc`` also see
# the caller's value.
_claude_debug: contextvars.ContextVar[bool] = contextvars.ContextVar(
    "tcc_claude_debug", default=False
)


def _debug(*args: Any) -> None:
    if not _claude_debug.get() and os.getenv("TCC_DEBUG", "").lower() not in (
        "true",
        "1",
    ):
        return
    parts = []
    for arg in args:
        if isinstance(arg, dict):
            parts.append(json.dumps(arg, indent=2))
        else:
            parts.append(str(arg))
    print("[TCC Debug]", *parts)


# ---------------------------------------------------------------------------
# Public dataclass – users pass this to ``query()``
# ---------------------------------------------------------------------------


@dataclass
class TCCConfig:
    """TCC configuration for a single ``query()`` call.

    Attributes:
        run_id:     Unique identifier for the run.  Auto-generated if not set.
        session_id: Optional session identifier to group related runs.
        metadata:   Arbitrary key/value metadata attached to the telemetry
                    payload (sent as ``customMetadata``).
        debug:      If ``True``, enables verbose ``[TCC Debug]`` logging for
                    this call (also honours the ``TCC_DEBUG`` env-var).
    """

    run_id: Optional[str] = None
    session_id: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    debug: bool = False


# ---------------------------------------------------------------------------
# Message serialisation helper
# ---------------------------------------------------------------------------


def _normalize_content_block(block: Any) -> Any:
    """Serialise an SDK ContentBlock to the CLI wire shape with a ``type`` discriminator."""
    from claude_agent_sdk import (
        TextBlock,
        ThinkingBlock,
        ToolUseBlock,
        ToolResultBlock,
        ServerToolUseBlock,
        ServerToolResultBlock,
    )

    if isinstance(block, TextBlock):
        return {"type": "text", "text": block.text}
    if isinstance(block, ThinkingBlock):
        return {
            "type": "thinking",
            "thinking": block.thinking,
            "signature": block.signature,
        }
    if isinstance(block, ToolUseBlock):
        return {
            "type": "tool_use",
            "id": block.id,
            "name": block.name,
            "input": block.input,
        }
    if isinstance(block, ToolResultBlock):
        out: Dict[str, Any] = {
            "type": "tool_result",
            "tool_use_id": block.tool_use_id,
        }
        if block.content is not None:
            out["content"] = block.content
        if block.is_error is not None:
            out["is_error"] = block.is_error
        return out
    if isinstance(block, ServerToolUseBlock):
        return {
            "type": "server_tool_use",
            "id": block.id,
            "name": block.name,
            "input": block.input,
        }
    if isinstance(block, ServerToolResultBlock):
        # Parser discriminator for this class is "advisor_tool_result"
        return {
            "type": "advisor_tool_result",
            "tool_use_id": block.tool_use_id,
            "content": block.content,
        }

    if dataclasses.is_dataclass(block) and not isinstance(block, type):
        try:
            return dataclasses.asdict(block)
        except (TypeError, ValueError):
            pass
    return {"raw": str(block)}


def _message_to_dict(message: Any) -> Dict[str, Any]:
    """Serialise an SDK message to the CLI wire-format dict expected by ``/v1/claude``.

    Inverts ``claude_agent_sdk/_internal/message_parser.py``: restores the
    top-level ``type`` discriminator and (for assistant/user) the ``message`` wrapper.
    """
    from claude_agent_sdk import (
        AssistantMessage,
        RateLimitEvent,
        ResultMessage,
        StreamEvent,
        SystemMessage,
        UserMessage,
    )

    if isinstance(message, AssistantMessage):
        inner: Dict[str, Any] = {
            "content": [_normalize_content_block(b) for b in message.content],
            "model": message.model,
        }
        if message.message_id is not None:
            inner["id"] = message.message_id
        if message.usage is not None:
            inner["usage"] = message.usage
        if message.stop_reason is not None:
            inner["stop_reason"] = message.stop_reason

        out: Dict[str, Any] = {"type": "assistant", "message": inner}
        if message.parent_tool_use_id is not None:
            out["parent_tool_use_id"] = message.parent_tool_use_id
        if message.error is not None:
            out["error"] = message.error
        if message.session_id is not None:
            out["session_id"] = message.session_id
        if message.uuid is not None:
            out["uuid"] = message.uuid
        return out

    if isinstance(message, UserMessage):
        if isinstance(message.content, list):
            content: Any = [_normalize_content_block(b) for b in message.content]
        else:
            content = message.content
        out = {"type": "user", "message": {"content": content}}
        if message.parent_tool_use_id is not None:
            out["parent_tool_use_id"] = message.parent_tool_use_id
        if message.tool_use_result is not None:
            out["tool_use_result"] = message.tool_use_result
        if message.uuid is not None:
            out["uuid"] = message.uuid
        return out

    if isinstance(message, SystemMessage):
        # ``data`` is the original CLI dict (already shaped for the wire);
        # copy so later mutations don't leak into the SDK's message state.
        return dict(message.data)

    if isinstance(message, ResultMessage):
        out = {
            "type": "result",
            "subtype": message.subtype,
            "duration_ms": message.duration_ms,
            "duration_api_ms": message.duration_api_ms,
            "is_error": message.is_error,
            "num_turns": message.num_turns,
            "session_id": message.session_id,
        }
        if message.stop_reason is not None:
            out["stop_reason"] = message.stop_reason
        if message.total_cost_usd is not None:
            out["total_cost_usd"] = message.total_cost_usd
        if message.usage is not None:
            out["usage"] = message.usage
        if message.result is not None:
            out["result"] = message.result
        if message.structured_output is not None:
            out["structured_output"] = message.structured_output
        # Wire key is camelCase "modelUsage"; Python renames to snake on parse.
        if message.model_usage is not None:
            out["modelUsage"] = message.model_usage
        if message.permission_denials is not None:
            out["permission_denials"] = message.permission_denials
        if message.errors is not None:
            out["errors"] = message.errors
        if message.uuid is not None:
            out["uuid"] = message.uuid
        return out

    if isinstance(message, StreamEvent):
        out = {
            "type": "stream_event",
            "uuid": message.uuid,
            "session_id": message.session_id,
            "event": message.event,
        }
        if message.parent_tool_use_id is not None:
            out["parent_tool_use_id"] = message.parent_tool_use_id
        return out

    if isinstance(message, RateLimitEvent):
        info = message.rate_limit_info
        info_dict: Dict[str, Any] = {"status": info.status}
        if info.resets_at is not None:
            info_dict["resetsAt"] = info.resets_at
        if info.rate_limit_type is not None:
            info_dict["rateLimitType"] = info.rate_limit_type
        if info.utilization is not None:
            info_dict["utilization"] = info.utilization
        if info.overage_status is not None:
            info_dict["overageStatus"] = info.overage_status
        if info.overage_resets_at is not None:
            info_dict["overageResetsAt"] = info.overage_resets_at
        if info.overage_disabled_reason is not None:
            info_dict["overageDisabledReason"] = info.overage_disabled_reason
        return {
            "type": "rate_limit_event",
            "rate_limit_info": info_dict,
            "uuid": message.uuid,
            "session_id": message.session_id,
        }

    if dataclasses.is_dataclass(message) and not isinstance(message, type):
        try:
            return dataclasses.asdict(message)
        except (TypeError, ValueError):
            pass
    return {"raw": str(message)}


# ---------------------------------------------------------------------------
# Telemetry sender
# ---------------------------------------------------------------------------


def _send_to_tcc(
    messages: List[Dict[str, Any]],
    custom_metadata: Optional[Dict[str, Any]],
    run_id: str,
    session_id: Optional[str],
    user_prompt: Optional[str],
    api_key: Optional[str],
    tcc_url: Optional[str],
) -> None:
    """POST collected messages to the TCC ``/v1/claude`` endpoint. Never raises."""
    payload: Dict[str, Any] = {
        "messages": messages,
        "runId": run_id,
    }
    if custom_metadata:
        payload["customMetadata"] = custom_metadata
    if session_id is not None:
        payload["sessionId"] = session_id
    if user_prompt is not None:
        payload["userPrompt"] = user_prompt

    _debug("Sending claude telemetry...")
    _debug("Payload:", payload)

    try:
        resolved_key = get_api_key(api_key)
        endpoint = tcc_url or get_url("/v1/claude", api_key=resolved_key)
        resp = requests.post(
            endpoint,
            json=payload,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {resolved_key}",
            },
            timeout=10,
        )

        if not resp.ok:
            print(
                f"[TCC] Failed to send claude telemetry: "
                f"{resp.status_code} {resp.text}"
            )
        else:
            _debug(f"Successfully sent {len(messages)} claude messages")
    except Exception as e:
        print(f"[TCC] Error sending claude telemetry: {e}")


# ---------------------------------------------------------------------------
# Instrumented wrapper
# ---------------------------------------------------------------------------


# asyncio only holds weak references to Tasks — fire-and-forget telemetry
# would be GC'd mid-flight without a strong ref.  Tasks add themselves here
# and remove themselves via a done callback.
_pending_telemetry_tasks: set = set()


class InstrumentedClaudeAgent:
    """Wrapped Claude Agent SDK with TCC telemetry collection.

    Instantiate via :func:`instrument_claude_agent` rather than directly.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        tcc_url: Optional[str] = None,
    ) -> None:
        self._api_key = api_key
        self._tcc_url = tcc_url

    # The return-type annotation is kept generic (``AsyncIterator``) to avoid
    # importing ``claude_agent_sdk`` at module level — the SDK is an optional
    # dependency.
    async def query(
        self,
        *,
        prompt: Any,
        options: Any = None,
        transport: Any = None,
        tcc_config: Optional[TCCConfig] = None,
    ) -> AsyncIterator:
        """Wrap ``claude_agent_sdk.query()`` with TCC telemetry.

        Parameters are identical to the upstream ``query()`` function with the
        addition of *tcc_config* for TCC-specific settings.

        Yields:
            The same ``Message`` objects that the upstream SDK yields.
        """
        from claude_agent_sdk import query as claude_query

        config = tcc_config or TCCConfig()

        run_id = config.run_id or str(uuid.uuid4())
        session_id = config.session_id
        metadata = config.metadata or {}

        debug_token = _claude_debug.set(config.debug)

        try:
            _debug("Claude query wrapper called")
            _debug("runId:", run_id)
            _debug("sessionId:", session_id)
            _debug("metadata:", metadata)

            messages: List[Dict[str, Any]] = []
            user_prompt = prompt if isinstance(prompt, str) else None

            def _fire_telemetry() -> None:
                """Schedule a fire-and-forget telemetry POST (mirrors TS)."""
                task = asyncio.create_task(
                    asyncio.to_thread(
                        _send_to_tcc,
                        messages=messages,
                        custom_metadata=metadata if metadata else None,
                        run_id=run_id,
                        session_id=session_id,
                        user_prompt=user_prompt,
                        api_key=self._api_key,
                        tcc_url=self._tcc_url,
                    )
                )
                _pending_telemetry_tasks.add(task)
                task.add_done_callback(_pending_telemetry_tasks.discard)

            try:
                _debug("Starting to collect messages")

                async for message in claude_query(
                    prompt=prompt,
                    options=options,
                    **({"transport": transport} if transport is not None else {}),
                ):
                    msg_dict = _message_to_dict(message)
                    msg_dict["receivedAtMs"] = int(time.time() * 1000)
                    msg_dict["tccMetadata"] = {
                        "runId": run_id,
                        "sessionId": session_id,
                    }
                    messages.append(msg_dict)

                    _debug(
                        f"Collected message type: "
                        f"{msg_dict.get('type', 'unknown')}, "
                        f"total: {len(messages)}"
                    )

                    yield message
            finally:
                # Covers normal completion, Exception, GeneratorExit (consumer
                # break / aclose), and CancelledError. GeneratorExit is a
                # BaseException so an `except Exception` clause would miss it,
                # dropping every collected message.
                if messages:
                    _debug(f"Firing telemetry with {len(messages)} messages")
                    _fire_telemetry()
        finally:
            _claude_debug.reset(debug_token)


# ---------------------------------------------------------------------------
# Public factory
# ---------------------------------------------------------------------------


def instrument_claude_agent(
    api_key: Optional[str] = None,
    tcc_url: Optional[str] = None,
) -> InstrumentedClaudeAgent:
    """Instrument the Claude Agent SDK for automatic observability.

    Returns an :class:`InstrumentedClaudeAgent` whose ``query()`` async
    generator wraps ``claude_agent_sdk.query()`` with TCC telemetry
    collection.

    Call once at startup, then use the returned object's ``query()`` method
    in place of the SDK's ``query()``.

    Args:
        api_key: TCC API key.  Falls back to the ``TCC_API_KEY`` env-var.
        tcc_url: Override the TCC endpoint URL.  Falls back to automatic
                 prod/dev selection based on the key prefix.

    Returns:
        An :class:`InstrumentedClaudeAgent` instance.
    """
    _debug("Initializing Claude Agent SDK instrumentation")
    return InstrumentedClaudeAgent(api_key=api_key, tcc_url=tcc_url)

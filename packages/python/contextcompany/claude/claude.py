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

import dataclasses
import os
import time
import uuid
from dataclasses import dataclass
from typing import Any, AsyncIterator, Dict, List, Optional

import requests

from .._utils import _debug
from ..config import get_api_key, get_url


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


def _message_to_dict(message: Any) -> Dict[str, Any]:
    """Convert a Claude SDK message to a JSON-serialisable dict.

    The SDK message types are dataclasses, so ``dataclasses.asdict()`` is the
    primary strategy.  Falls back to ``__dict__`` scraping and finally
    ``str()`` for totally opaque objects.
    """
    if dataclasses.is_dataclass(message) and not isinstance(message, type):
        try:
            return dataclasses.asdict(message)
        except (TypeError, ValueError):
            # Some nested objects may not be serialisable via asdict
            pass

    if hasattr(message, "__dict__"):
        return {
            k: v for k, v in message.__dict__.items() if not k.startswith("_")
        }

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
    """POST collected messages to the TCC ``/v1/claude`` endpoint.

    The payload shape matches the TypeScript implementation so the same
    backend handler can process both.
    """
    resolved_key = get_api_key(api_key)
    endpoint = tcc_url or get_url("/v1/claude", api_key=resolved_key)

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

        # Honour the debug flag for this call
        if config.debug:
            os.environ["TCC_DEBUG"] = "true"

        _debug("Claude query wrapper called")
        _debug("runId:", run_id)
        _debug("sessionId:", session_id)
        _debug("metadata:", metadata)

        messages: List[Dict[str, Any]] = []
        user_prompt = prompt if isinstance(prompt, str) else None

        try:
            _debug("Starting to collect messages")

            async for message in claude_query(
                prompt=prompt,
                options=options,
                **({"transport": transport} if transport is not None else {}),
            ):
                # Serialise and timestamp the message
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

                # Yield transparently — downstream code sees the original
                yield message

            # ----- Stream completed successfully ----- #
            if messages:
                _debug(f"Stream completed with {len(messages)} messages")
                _debug("Sending telemetry data...")

                _send_to_tcc(
                    messages=messages,
                    custom_metadata=metadata if metadata else None,
                    run_id=run_id,
                    session_id=session_id,
                    user_prompt=user_prompt,
                    api_key=self._api_key,
                    tcc_url=self._tcc_url,
                )

        except Exception:
            # On error, attempt to send whatever we collected so far
            if messages:
                try:
                    _send_to_tcc(
                        messages=messages,
                        custom_metadata=metadata if metadata else None,
                        run_id=run_id,
                        session_id=session_id,
                        user_prompt=user_prompt,
                        api_key=self._api_key,
                        tcc_url=self._tcc_url,
                    )
                except Exception:
                    pass
            raise


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

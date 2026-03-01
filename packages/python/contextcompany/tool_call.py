import json
import uuid
from typing import Any, Dict, Optional, Union

from ._utils import _now_iso, _debug, _send_payload


class ToolCall:
    def __init__(
        self,
        run_id: str,
        tool_call_id: Optional[str] = None,
        tool_name: Optional[str] = None,
    ) -> None:
        self._run_id = run_id
        self._tool_call_id = tool_call_id or str(uuid.uuid4())

        self._start_time: str = _now_iso()

        self._name: Optional[str] = tool_name

        self._status_code: int = 0
        self._status_message: Optional[str] = None

        self._args: Optional[str] = None
        self._result: Optional[str] = None

        self._ended = False

        _debug("ToolCall created")
        _debug("tool_call_id:", self._tool_call_id)
        _debug("run_id:", self._run_id)
        _debug("start_time:", self._start_time)

    def name(self, tool_name: str) -> "ToolCall":
        self._name = tool_name
        _debug("ToolCall name set:", tool_name)
        return self

    def args(self, value: Union[str, Dict[str, Any]]) -> "ToolCall":
        self._args = value if isinstance(value, str) else json.dumps(value)
        _debug("ToolCall args set:", self._args[:200] if len(self._args) > 200 else self._args)
        return self

    def result(self, value: Union[str, Dict[str, Any]]) -> "ToolCall":
        self._result = value if isinstance(value, str) else json.dumps(value)
        _debug("ToolCall result set:", self._result[:200] if len(self._result) > 200 else self._result)
        return self

    def status(self, code: int, message: Optional[str] = None) -> "ToolCall":
        self._status_code = code
        if message is not None:
            self._status_message = message
        _debug("ToolCall status set:", code, message)
        return self

    def error(self, status_message: str = "") -> None:
        if self._ended:
            raise RuntimeError("[TCC] ToolCall has already ended")

        _debug("ToolCall error:", status_message)
        self._status_code = 2
        if status_message:
            self._status_message = status_message
        self._ended = True

        payload = self._build_payload()
        _send_payload(payload, "tool_call")

    def end(self) -> None:
        if self._ended:
            raise RuntimeError("[TCC] ToolCall has already ended")

        if self._name is None:
            raise ValueError(
                "[TCC] Cannot end tool call: name is required. "
                "Call tc.name(...) or pass it to tool_call('name') before tc.end()"
            )

        self._ended = True

        payload = self._build_payload()
        _send_payload(payload, "tool_call")

    def _build_payload(self) -> Dict[str, Any]:
        end_time = _now_iso()

        payload: Dict[str, Any] = {
            "type": "tool_call",
            "run_id": self._run_id,
            "tool_call_id": self._tool_call_id,
            "tool_name": self._name or "unknown",
            "start_time": self._start_time,
            "end_time": end_time,
            "status_code": self._status_code,
        }

        if self._status_message is not None:
            payload["status_message"] = self._status_message
        if self._args is not None:
            payload["args"] = self._args
        if self._result is not None:
            payload["result"] = self._result

        return payload


def tool_call(
    run_id: str,
    tool_call_id: Optional[str] = None,
    tool_name: Optional[str] = None,
) -> ToolCall:
    return ToolCall(run_id=run_id, tool_call_id=tool_call_id, tool_name=tool_name)

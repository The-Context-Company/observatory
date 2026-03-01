import uuid
from typing import Any, Dict, Optional

from ._utils import _now_iso, _SENTINEL, _debug, _send_payload


class Step:
    def __init__(
        self,
        run_id: str,
        step_id: Optional[str] = None,
    ) -> None:
        self._run_id = run_id
        self._step_id = step_id or str(uuid.uuid4())

        self._start_time: str = _now_iso()

        self._prompt: object = _SENTINEL
        self._response: object = _SENTINEL

        self._model_requested: Optional[str] = None
        self._model_used: Optional[str] = None
        self._finish_reason: Optional[str] = None

        self._status_code: int = 0
        self._status_message: Optional[str] = None

        self._prompt_uncached_tokens: Optional[int] = None
        self._prompt_cached_tokens: Optional[int] = None
        self._completion_tokens: Optional[int] = None
        self._real_total_cost: Optional[float] = None

        self._tool_definitions: Optional[str] = None

        self._ended = False

        _debug("Step created")
        _debug("step_id:", self._step_id)
        _debug("run_id:", self._run_id)
        _debug("start_time:", self._start_time)

    def prompt(self, text: str) -> "Step":
        self._prompt = text
        _debug("Step prompt set:", text[:200] if len(text) > 200 else text)
        return self

    def response(self, text: str) -> "Step":
        self._response = text
        _debug("Step response set:", text[:200] if len(text) > 200 else text)
        return self

    def model(self, requested: Optional[str] = None, used: Optional[str] = None) -> "Step":
        if requested is not None:
            self._model_requested = requested
            _debug("Step model_requested:", requested)
        if used is not None:
            self._model_used = used
            _debug("Step model_used:", used)
        return self

    def finish_reason(self, reason: str) -> "Step":
        self._finish_reason = reason
        _debug("Step finish_reason:", reason)
        return self

    def tokens(
        self,
        prompt_uncached: Optional[int] = None,
        prompt_cached: Optional[int] = None,
        completion: Optional[int] = None,
    ) -> "Step":
        if prompt_uncached is not None:
            self._prompt_uncached_tokens = prompt_uncached
        if prompt_cached is not None:
            self._prompt_cached_tokens = prompt_cached
        if completion is not None:
            self._completion_tokens = completion
        _debug("Step tokens:", {
            "prompt_uncached": self._prompt_uncached_tokens,
            "prompt_cached": self._prompt_cached_tokens,
            "completion": self._completion_tokens,
        })
        return self

    def cost(self, real_total: float) -> "Step":
        self._real_total_cost = real_total
        _debug("Step real_total_cost:", real_total)
        return self

    def tool_definitions(self, definitions: str) -> "Step":
        self._tool_definitions = definitions
        _debug("Step tool_definitions set:", definitions[:200] if len(definitions) > 200 else definitions)
        return self

    def tool_call(
        self,
        tool_name: Optional[str] = None,
        tool_call_id: Optional[str] = None,
    ) -> "ToolCall":
        from .tool_call import ToolCall
        return ToolCall(run_id=self._run_id, tool_call_id=tool_call_id, tool_name=tool_name)

    def status(self, code: int, message: Optional[str] = None) -> "Step":
        self._status_code = code
        if message is not None:
            self._status_message = message
        _debug("Step status set:", code, message)
        return self

    def error(self, status_message: str = "") -> None:
        if self._ended:
            raise RuntimeError("[TCC] Step has already ended")

        _debug("Step error:", status_message)
        self._status_code = 2
        if status_message:
            self._status_message = status_message
        self._ended = True

        payload = self._build_payload()
        _send_payload(payload, "step")

    def end(self) -> None:
        if self._ended:
            raise RuntimeError("[TCC] Step has already ended")

        if self._prompt is _SENTINEL:
            raise ValueError("[TCC] Cannot end step: prompt is required. Call s.prompt(...) before s.end()")

        if self._response is _SENTINEL:
            raise ValueError("[TCC] Cannot end step: response is required. Call s.response(...) before s.end()")

        self._ended = True

        payload = self._build_payload()
        _send_payload(payload, "step")

    def _build_payload(self) -> Dict[str, Any]:
        end_time = _now_iso()

        payload: Dict[str, Any] = {
            "type": "step",
            "run_id": self._run_id,
            "step_id": self._step_id,
            "start_time": self._start_time,
            "end_time": end_time,
            "status_code": self._status_code,
        }

        if self._prompt is not _SENTINEL:
            payload["prompt"] = self._prompt
        if self._response is not _SENTINEL:
            payload["response"] = self._response
        if self._model_requested is not None:
            payload["model_requested"] = self._model_requested
        if self._model_used is not None:
            payload["model_used"] = self._model_used
        if self._finish_reason is not None:
            payload["finish_reason"] = self._finish_reason
        if self._status_message is not None:
            payload["status_message"] = self._status_message
        if self._prompt_uncached_tokens is not None:
            payload["prompt_uncached_tokens"] = self._prompt_uncached_tokens
        if self._prompt_cached_tokens is not None:
            payload["prompt_cached_tokens"] = self._prompt_cached_tokens
        if self._completion_tokens is not None:
            payload["completion_tokens"] = self._completion_tokens
        if self._real_total_cost is not None:
            payload["real_total_cost"] = self._real_total_cost
        if self._tool_definitions is not None:
            payload["tool_definitions"] = self._tool_definitions

        return payload


def step(
    run_id: str,
    step_id: Optional[str] = None,
) -> Step:
    return Step(run_id=run_id, step_id=step_id)

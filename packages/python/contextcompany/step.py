import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import requests

from .config import get_api_key, get_url

_SENTINEL = object()


def _now_iso() -> str:
    dt = datetime.now(timezone.utc)
    return dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond // 1000:03d}Z"


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

    def prompt(self, text: str) -> "Step":
        self._prompt = text
        return self

    def response(self, text: str) -> "Step":
        self._response = text
        return self

    def model(self, requested: Optional[str] = None, used: Optional[str] = None) -> "Step":
        if requested is not None:
            self._model_requested = requested
        if used is not None:
            self._model_used = used
        return self

    def finish_reason(self, reason: str) -> "Step":
        self._finish_reason = reason
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
        return self

    def cost(self, real_total: float) -> "Step":
        self._real_total_cost = real_total
        return self

    def tool_definitions(self, definitions: str) -> "Step":
        self._tool_definitions = definitions
        return self

    def status(self, code: int, message: Optional[str] = None) -> "Step":
        self._status_code = code
        if message is not None:
            self._status_message = message
        return self

    def error(self, status_message: str = "") -> None:
        self._status_code = 2
        if status_message:
            self._status_message = status_message
        self.end()

    def end(self) -> None:
        if self._ended:
            raise RuntimeError("[TCC] Step has already ended")

        if self._prompt is _SENTINEL:
            raise ValueError("[TCC] Cannot end step: prompt is required. Call s.prompt(...) before s.end()")

        if self._response is _SENTINEL:
            raise ValueError("[TCC] Cannot end step: response is required. Call s.response(...) before s.end()")

        self._ended = True
        end_time = _now_iso()

        payload: Dict[str, Any] = {
            "type": "step",
            "run_id": self._run_id,
            "step_id": self._step_id,
            "start_time": self._start_time,
            "end_time": end_time,
            "prompt": self._prompt,
            "response": self._response,
            "status_code": self._status_code,
        }

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

        try:
            api_key = get_api_key()
            endpoint = get_url(
                "https://api.thecontext.company/v1/custom",
                "https://dev.thecontext.company/v1/custom",
            )

            resp = requests.post(
                endpoint,
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {api_key}",
                },
                timeout=10,
            )

            if not resp.ok:
                print(f"[TCC] Failed to send step: {resp.status_code} {resp.text}")

        except Exception as e:
            print(f"[TCC] Failed to send step: {e}")


def step(
    run_id: str,
    step_id: Optional[str] = None,
) -> Step:
    return Step(run_id=run_id, step_id=step_id)

import json
import uuid
from typing import Any, Dict, Optional

from ._utils import _now_iso, _SENTINEL, _debug, _send_payload


class Run:
    def __init__(
        self,
        run_id: Optional[str] = None,
        session_id: Optional[str] = None,
        conversational: Optional[bool] = None,
    ) -> None:
        self._run_id = run_id or str(uuid.uuid4())
        self._session_id = session_id
        self._conversational = conversational

        self._start_time: str = _now_iso()

        self._prompt: object = _SENTINEL
        self._response: Optional[str] = None

        self._status_code: int = 0
        self._status_message: Optional[str] = None

        self._metadata: Optional[Dict[str, str]] = None

        self._ended = False

        _debug("Run created")
        _debug("run_id:", self._run_id)
        _debug("session_id:", self._session_id)
        _debug("conversational:", self._conversational)
        _debug("start_time:", self._start_time)

    @property
    def run_id(self) -> str:
        return self._run_id

    def step(self, step_id: Optional[str] = None) -> "Step":
        from .step import Step
        return Step(run_id=self._run_id, step_id=step_id)

    def prompt(self, user_prompt: str, system_prompt: Optional[str] = None) -> "Run":
        if system_prompt is not None:
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ]
            self._prompt = json.dumps(messages)
        else:
            self._prompt = user_prompt

        preview = str(self._prompt)
        _debug("Run prompt set:", preview[:200] if len(preview) > 200 else preview)
        return self

    def response(self, text: str) -> "Run":
        self._response = text
        _debug("Run response set:", text[:200] if len(text) > 200 else text)
        return self

    def status(self, code: int, message: Optional[str] = None) -> "Run":
        self._status_code = code
        if message is not None:
            self._status_message = message
        _debug("Run status set:", code, message)
        return self

    def metadata(self, json: Optional[Dict[str, str]] = None, **kwargs: str) -> "Run":
        if self._metadata is None:
            self._metadata = {}
        if json is not None:
            self._metadata.update(json)
        self._metadata.update(kwargs)
        _debug("Run metadata:", self._metadata)
        return self

    def error(self, status_message: str = "") -> None:
        if self._ended:
            raise RuntimeError("[TCC] Run has already ended")

        _debug("Run error:", status_message)
        self._status_code = 2
        if status_message:
            self._status_message = status_message
        self._ended = True

        payload = self._build_payload()
        _send_payload(payload, "run")

    def end(self) -> None:
        if self._ended:
            raise RuntimeError("[TCC] Run has already ended")

        if self._prompt is _SENTINEL:
            raise ValueError("[TCC] Cannot end run: prompt is required. Call r.prompt(...) before r.end()")

        self._ended = True

        payload = self._build_payload()
        _send_payload(payload, "run")

    def _build_payload(self) -> Dict[str, Any]:
        end_time = _now_iso()

        payload: Dict[str, Any] = {
            "type": "run",
            "run_id": self._run_id,
            "start_time": self._start_time,
            "end_time": end_time,
            "status_code": self._status_code,
        }

        if self._prompt is not _SENTINEL:
            payload["prompt"] = self._prompt
        if self._session_id is not None:
            payload["session_id"] = self._session_id
        if self._conversational is not None:
            payload["conversational"] = self._conversational
        if self._response is not None:
            payload["response"] = self._response
        if self._status_message is not None:
            payload["status_message"] = self._status_message
        if self._metadata is not None:
            payload["metadata"] = self._metadata

        return payload


def run(
    run_id: Optional[str] = None,
    session_id: Optional[str] = None,
    conversational: Optional[bool] = None,
) -> Run:
    return Run(
        run_id=run_id,
        session_id=session_id,
        conversational=conversational,
    )

from datetime import datetime, timezone
from typing import Any, Dict, Optional

import requests

from .config import get_api_key, get_endpoint

_SENTINEL = object()


def _now_iso() -> str:
    dt = datetime.now(timezone.utc)
    return dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond // 1000:03d}Z"


class Run:
    def __init__(
        self,
        session_id: Optional[str] = None,
        conversational: Optional[bool] = None,
        run_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        self._ended = False
        self._prompt: object = _SENTINEL
        self._response: Optional[str] = None
        self._status_code: Optional[int] = None
        self._status_message: Optional[str] = None
        self._start_time: str = _now_iso()
        self._run_id = run_id
        self._session_id = session_id
        self._conversational = conversational
        self._metadata = metadata

    def prompt(self, text: str) -> "Run":
        self._prompt = text
        return self

    def response(self, text: str) -> "Run":
        self._response = text
        return self

    def status(self, code: int, message: Optional[str] = None) -> "Run":
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
            raise RuntimeError("[TCC] Run has already ended")

        if self._prompt is _SENTINEL:
            raise ValueError("[TCC] Cannot end run: prompt is required. Call r.prompt(...) before r.end()")

        self._ended = True
        end_time = _now_iso()

        payload: Dict[str, Any] = {
            "start_time": self._start_time,
            "end_time": end_time,
            "prompt": self._prompt,
            "status_code": self._status_code if self._status_code is not None else 0,
        }

        if self._run_id is not None:
            payload["run_id"] = self._run_id
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

        try:
            api_key = get_api_key()
            endpoint = get_endpoint()

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
                print(f"[TCC] Failed to send run: {resp.status_code} {resp.text}")

        except Exception as e:
            print(f"[TCC] Failed to send run: {e}")


def run(
    session_id: Optional[str] = None,
    conversational: Optional[bool] = None,
    run_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> Run:
    return Run(
        session_id=session_id,
        conversational=conversational,
        run_id=run_id,
        metadata=metadata,
    )

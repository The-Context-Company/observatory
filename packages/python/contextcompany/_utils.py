import json
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import requests

_SENTINEL = object()


def _debug(*args: Any) -> None:
    if os.getenv("TCC_DEBUG", "").lower() not in ("true", "1"):
        return
    parts = []
    for arg in args:
        if isinstance(arg, dict):
            parts.append(json.dumps(arg, indent=2))
        else:
            parts.append(str(arg))
    print("[TCC Debug]", *parts)


def _now_iso() -> str:
    dt = datetime.now(timezone.utc)
    return dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond // 1000:03d}Z"


def _send_payload(
    payload: Dict[str, Any],
    label: str,
    api_key: Optional[str] = None,
    tcc_url: Optional[str] = None,
) -> None:
    from .config import get_api_key, get_url

    _debug(f"Sending {label}...")
    _debug("Payload:", payload)

    try:
        api_key = get_api_key(api_key)
        endpoint = get_url(
            "https://api.thecontext.company/v1/custom",
            "https://dev.thecontext.company/v1/custom",
            tcc_url=tcc_url,
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
            print(f"[TCC] Failed to send {label}: {resp.status_code} {resp.text}")
        else:
            _debug(f"Successfully sent {label}")

    except Exception as e:
        print(f"[TCC] Failed to send {label}: {e}")

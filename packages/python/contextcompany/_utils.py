import json
import os
from datetime import datetime, timezone
from typing import Any

_SENTINEL = object()

_DEBUG_ENABLED = os.getenv("TCC_DEBUG", "").lower() in ("true", "1")


def _debug(*args: Any) -> None:
    if not _DEBUG_ENABLED:
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

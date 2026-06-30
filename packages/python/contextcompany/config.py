import os
from typing import Optional
from urllib.parse import urlparse

PROD_BASE = "https://api.thecontext.company"
DEV_BASE = "https://dev.thecontext.company"
ALLOWED_REMOTE_ORIGINS = {PROD_BASE, DEV_BASE}


def get_api_key(api_key: Optional[str] = None) -> str:
    key = api_key or os.getenv("TCC_API_KEY")
    if not key:
        raise ValueError(
            "TCC API key is required. Set TCC_API_KEY environment variable "
            "or pass api_key parameter to the instrument function."
        )
    return key


def get_base_url(api_key: Optional[str] = None) -> str:
    url = os.getenv("TCC_BASE_URL")
    if url:
        return normalize_base_url(url)
    key = api_key or os.getenv("TCC_API_KEY", "")
    return DEV_BASE if key.startswith("dev_") else PROD_BASE


def get_url(path: str, api_key: Optional[str] = None) -> str:
    return f"{get_base_url(api_key)}{path}"


def _is_unsafe_base_url_allowed() -> bool:
    return os.getenv("TCC_ALLOW_UNSAFE_BASE_URL") == "1"


def _is_localhost_host(hostname: str) -> bool:
    return hostname.lower() in {"localhost", "127.0.0.1", "::1"}


def _split_origin(url: str, label: str) -> tuple[str, str, str]:
    """Parse `url` into ``(origin, hostname, path)``; raise on malformed input."""
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError(f"[TCC] Invalid {label}: {url}")

    hostname = parsed.hostname.lower()
    host = f"[{hostname}]" if ":" in hostname and not hostname.startswith("[") else hostname
    is_default_port = (parsed.scheme == "https" and parsed.port == 443) or (
        parsed.scheme == "http" and parsed.port == 80
    )
    port = f":{parsed.port}" if parsed.port and not is_default_port else ""
    origin = f"{parsed.scheme.lower()}://{host}{port}"
    return origin, hostname, parsed.path


def _is_origin_allowed(origin: str, hostname: str) -> bool:
    """Whether the SDK may send the API key / telemetry to this origin."""
    return (
        origin in ALLOWED_REMOTE_ORIGINS
        or _is_localhost_host(hostname)
        or _is_unsafe_base_url_allowed()
    )


def normalize_base_url(url: str) -> str:
    origin, hostname, path = _split_origin(url, "TCC base URL")
    base = f"{origin}{path.rstrip('/')}"

    if _is_origin_allowed(origin, hostname):
        return base

    raise ValueError(
        f"[TCC] Refusing unsafe TCC base URL ({base}). Use {PROD_BASE}, {DEV_BASE}, "
        "localhost, or set TCC_ALLOW_UNSAFE_BASE_URL=1 for self-hosted testing."
    )


def assert_safe_url(url: str) -> str:
    """Defense-in-depth guard for network sinks that attach the TCC API key.

    Returns `url` unchanged when it targets an allowed TCC origin
    (prod/dev/localhost) or ``TCC_ALLOW_UNSAFE_BASE_URL=1`` is set; otherwise
    raises ``ValueError``. Complements :func:`normalize_base_url`: even if an
    endpoint reaches a sink without base-URL normalization (e.g. an explicit
    ``tcc_url`` override or a hijacked ``TCC_FEEDBACK_URL``), the API key and
    trace data are never sent to an untrusted host.
    """
    origin, hostname, _path = _split_origin(url, "TCC URL")

    if _is_origin_allowed(origin, hostname):
        return url

    raise ValueError(
        f"[TCC] Refusing to send credentials to unsafe URL ({origin}). Use "
        f"{PROD_BASE}, {DEV_BASE}, localhost, or set TCC_ALLOW_UNSAFE_BASE_URL=1 "
        "for self-hosted testing."
    )

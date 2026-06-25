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


def normalize_base_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError(f"[TCC] Invalid TCC base URL: {url}")

    hostname = parsed.hostname.lower()
    host = f"[{hostname}]" if ":" in hostname and not hostname.startswith("[") else hostname
    is_default_port = (parsed.scheme == "https" and parsed.port == 443) or (
        parsed.scheme == "http" and parsed.port == 80
    )
    port = f":{parsed.port}" if parsed.port and not is_default_port else ""
    origin = f"{parsed.scheme.lower()}://{host}{port}"
    base = f"{origin}{parsed.path.rstrip('/')}"

    if origin in ALLOWED_REMOTE_ORIGINS or _is_localhost_host(hostname):
        return base

    if _is_unsafe_base_url_allowed():
        return base

    raise ValueError(
        f"[TCC] Refusing unsafe TCC base URL ({base}). Use {PROD_BASE}, {DEV_BASE}, "
        "localhost, or set TCC_ALLOW_UNSAFE_BASE_URL=1 for self-hosted testing."
    )

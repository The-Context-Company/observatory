import os
from typing import Optional

PROD_BASE = "https://api.thecontext.company"
DEV_BASE = "https://dev.thecontext.company"


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
        return url.rstrip("/")
    key = api_key or os.getenv("TCC_API_KEY", "")
    return DEV_BASE if key.startswith("dev_") else PROD_BASE


def get_url(path: str, api_key: Optional[str] = None) -> str:
    return f"{get_base_url(api_key)}{path}"

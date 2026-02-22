import os
from typing import Optional


def get_api_key(api_key: Optional[str] = None) -> str:
    key = api_key or os.getenv("TCC_API_KEY")
    if not key:
        raise ValueError(
            "TCC API key is required. Set TCC_API_KEY environment variable "
            "or pass api_key parameter to the instrument function."
        )
    return key


def get_url(prod_url: str, dev_url: str) -> str:
    if os.getenv("TCC_URL"):
        return os.getenv("TCC_URL")  # type: ignore
    api_key = os.getenv("TCC_API_KEY", "")
    return dev_url if api_key.startswith("dev_") else prod_url

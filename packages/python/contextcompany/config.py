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


def get_url(prod_url: str, dev_url: str, tcc_url: Optional[str] = None, api_key: Optional[str] = None) -> str:
    url = tcc_url or os.getenv("TCC_URL")
    if url:
        return url
    key = api_key or os.getenv("TCC_API_KEY", "")
    return dev_url if key.startswith("dev_") else prod_url

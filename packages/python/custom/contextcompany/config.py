import os
from typing import Optional

PROD_ENDPOINT = "https://api.thecontext.company/v1/custom"
DEV_ENDPOINT = "https://dev.thecontext.company/v1/custom"


def get_api_key(api_key: Optional[str] = None) -> str:
    key = api_key or os.getenv("TCC_API_KEY")
    if not key:
        raise ValueError(
            "TCC API key is required. Set TCC_API_KEY environment variable "
            "or pass api_key parameter."
        )
    return key


def get_endpoint(endpoint: Optional[str] = None) -> str:
    if endpoint:
        return endpoint
    env_url = os.getenv("TCC_URL")
    if env_url:
        return env_url
    api_key = os.getenv("TCC_API_KEY", "")
    if api_key.startswith("dev_"):
        return DEV_ENDPOINT
    return PROD_ENDPOINT

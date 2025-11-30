import os
from typing import Optional

# Default values
DEFAULT_ENDPOINT = "https://api.thecontext.company/v1/traces"


def get_api_key(api_key: Optional[str] = None) -> str:
    key = api_key or os.getenv("TCC_API_KEY")
    if not key:
        raise ValueError(
            "TCC API key is required. Set TCC_API_KEY environment variable "
            "or pass api_key parameter to the instrument function."
        )
    return key


def get_endpoint(endpoint: Optional[str] = None) -> str:
    return endpoint or os.getenv("TCC_URL", DEFAULT_ENDPOINT)

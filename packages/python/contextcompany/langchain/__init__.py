"""LangChain instrumentation for The Context Company."""

from typing import Optional

from opentelemetry.instrumentation.langchain import LangchainInstrumentor
from opentelemetry.sdk.trace import TracerProvider

from .base import setup_instrumentation
from ..config import get_api_key, get_local_otlp_url, get_url
from .._utils import _debug


def instrument_langchain(
    api_key: Optional[str] = None,
    tcc_url: Optional[str] = None,
    local: bool = False,
) -> TracerProvider:
    if local:
        resolved_api_key = api_key
        resolved_endpoint = get_local_otlp_url(tcc_url)
    else:
        resolved_api_key = get_api_key(api_key)
        resolved_endpoint = tcc_url or get_url("/v1/traces", api_key=resolved_api_key)

    _debug("Initializing LangChain instrumentation")
    _debug(f"Local mode: {local}")
    _debug(f"Endpoint: {resolved_endpoint}")

    provider = setup_instrumentation(
        api_key=resolved_api_key,
        endpoint=resolved_endpoint,
    )

    LangchainInstrumentor().instrument()

    _debug("LangChain OpenTelemetry instrumentation initialized")

    return provider


__all__ = ["instrument_langchain"]

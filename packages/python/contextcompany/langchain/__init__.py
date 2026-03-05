"""LangChain instrumentation for The Context Company."""

from typing import Optional

from opentelemetry.instrumentation.langchain import LangchainInstrumentor
from opentelemetry.sdk.trace import TracerProvider

from .base import setup_instrumentation
from ..config import get_api_key, get_url


def instrument_langchain(
    api_key: Optional[str] = None,
    tcc_url: Optional[str] = None,
) -> TracerProvider:
    resolved_api_key = get_api_key(api_key)
    resolved_endpoint = get_url(
        "https://api.thecontext.company/v1/traces",
        "https://dev.thecontext.company/v1/traces",
        tcc_url=tcc_url,
        api_key=resolved_api_key,
    )

    provider = setup_instrumentation(
        api_key=resolved_api_key,
        endpoint=resolved_endpoint,
    )

    LangchainInstrumentor().instrument()

    print(f"TCC: LangChain OpenTelemetry instrumentation initialized")
    print(f"TCC: Exporting traces to: {resolved_endpoint}")

    return provider


__all__ = ["instrument_langchain"]

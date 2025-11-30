"""LangChain instrumentation for The Context Company."""

from typing import Optional

from opentelemetry.instrumentation.langchain import LangchainInstrumentor
from opentelemetry.sdk.trace import TracerProvider

from .base import setup_instrumentation
from ..config import get_api_key, get_endpoint


def instrument_langchain(
    api_key: Optional[str] = None,
    endpoint: Optional[str] = None,
) -> TracerProvider:
    # Get configuration values
    resolved_api_key = get_api_key(api_key)
    resolved_endpoint = get_endpoint(endpoint)

    # Set up OpenTelemetry instrumentation
    provider = setup_instrumentation(
        api_key=resolved_api_key,
        endpoint=resolved_endpoint,
    )

    # Instrument LangChain
    LangchainInstrumentor().instrument()

    print(f"TCC: LangChain OpenTelemetry instrumentation initialized")
    print(f"TCC: Exporting traces to: {resolved_endpoint}")

    return provider


__all__ = ["instrument_langchain"]

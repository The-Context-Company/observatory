"""Agno framework instrumentation for The Context Company.

Automatically captures Run, Step, and ToolCall data from Agno agents
using OpenTelemetry via the OpenInference Agno instrumentor.

Usage:
    from contextcompany.agno import instrument_agno

    instrument_agno()

    # Your Agno code is now automatically traced
    from agno.agent import Agent
    from agno.models.openai import OpenAIChat

    agent = Agent(model=OpenAIChat(id="gpt-4o"), tools=[...])
    response = agent.run("What is the weather in SF?")
"""

from typing import Optional

from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.resources import Resource
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter

from ..otel import RunIdSpanProcessor, TraceBatchSpanProcessor
from ..config import get_api_key, get_url
from .._utils import _debug
from .exporter import MetadataFixingExporter


def instrument_agno(
    api_key: Optional[str] = None,
    tcc_url: Optional[str] = None,
) -> TracerProvider:
    """Instrument the Agno framework for automatic observability.

    Sets up an OpenTelemetry TracerProvider with a TCC exporter and
    applies the OpenInference Agno auto-instrumentor.

    Call this once at startup, before creating any Agno Agent or Team
    instances.

    Args:
        api_key: TCC API key. Falls back to the ``TCC_API_KEY`` env var.
        tcc_url: Override the TCC endpoint URL. Falls back to ``TCC_URL``
                 env var, then auto-selects prod/dev based on the key prefix.

    Returns:
        The configured ``TracerProvider``.
    """
    try:
        from openinference.instrumentation.agno import AgnoInstrumentor
    except ImportError:
        raise ImportError(
            "The 'openinference-instrumentation-agno' package is required "
            "for Agno instrumentation. "
            "Install it with:  pip install contextcompany[agno]"
        )

    resolved_api_key = get_api_key(api_key)
    resolved_endpoint = tcc_url or get_url("/v1/traces", api_key=resolved_api_key)

    _debug("Initializing Agno instrumentation")
    _debug(f"Endpoint: {resolved_endpoint}")

    provider = TracerProvider(resource=Resource(attributes={}))
    provider.add_span_processor(RunIdSpanProcessor())

    base_exporter = OTLPSpanExporter(
        endpoint=resolved_endpoint,
        headers={"Authorization": f"Bearer {resolved_api_key}"},
    )
    fixing_exporter = MetadataFixingExporter(base_exporter)
    provider.add_span_processor(
        TraceBatchSpanProcessor(exporter=fixing_exporter, timeout_seconds=600)
    )

    trace.set_tracer_provider(provider)

    AgnoInstrumentor().instrument(tracer_provider=provider)

    _debug("Agno OpenTelemetry instrumentation initialized")

    return provider


__all__ = ["instrument_agno"]

"""CrewAI framework instrumentation for The Context Company.

Automatically captures Crew, Agent, Task, and LLM call data from CrewAI
workflows using OpenTelemetry via the Traceloop CrewAI instrumentor.

Usage:
    from contextcompany.crewai import instrument_crewai

    instrument_crewai()

    # Your CrewAI code is now automatically traced
    from crewai import Agent, Task, Crew, Process

    agent = Agent(role="Researcher", goal="...", backstory="...", llm="gpt-4o")
    task = Task(description="...", expected_output="...", agent=agent)
    crew = Crew(agents=[agent], tasks=[task], process=Process.sequential)
    result = crew.kickoff()
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


def instrument_crewai(
    api_key: Optional[str] = None,
    tcc_url: Optional[str] = None,
) -> TracerProvider:
    """Instrument the CrewAI framework for automatic observability.

    Sets up an OpenTelemetry TracerProvider with a TCC exporter and
    applies the Traceloop CrewAI auto-instrumentor, which patches
    ``Crew.kickoff``, ``Agent.execute_task``, ``Task.execute_sync``,
    and ``LLM.call``.

    Call this once at startup, before creating any CrewAI Crew, Agent,
    or Task instances.

    Args:
        api_key: TCC API key. Falls back to the ``TCC_API_KEY`` env var.
        tcc_url: Override the TCC endpoint URL. Falls back to ``TCC_URL``
                 env var, then auto-selects prod/dev based on the key prefix.

    Returns:
        The configured ``TracerProvider``.
    """
    try:
        from opentelemetry.instrumentation.crewai import CrewAIInstrumentor
    except ImportError:
        raise ImportError(
            "The 'opentelemetry-instrumentation-crewai' package is required "
            "for CrewAI instrumentation. "
            "Install it with:  pip install contextcompany[crewai]"
        )

    resolved_api_key = get_api_key(api_key)
    resolved_endpoint = get_url(
        "https://api.thecontext.company/v1/traces",
        "https://dev.thecontext.company/v1/traces",
        tcc_url=tcc_url,
        api_key=resolved_api_key,
    )

    _debug("Initializing CrewAI instrumentation")
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

    CrewAIInstrumentor().instrument(tracer_provider=provider)

    _debug("CrewAI OpenTelemetry instrumentation initialized")

    return provider


__all__ = ["instrument_crewai"]

from typing import Optional

from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.resources import Resource
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from ..otel import RunIdSpanProcessor, TraceBatchSpanProcessor
from .exporter import RunIdFixingExporter


def create_tracer_provider(resource_attributes: Optional[dict] = None) -> TracerProvider:
    resource = Resource(attributes=resource_attributes or {})
    return TracerProvider(resource=resource)


def create_otlp_exporter(endpoint: str, api_key: str, headers: Optional[dict] = None) -> OTLPSpanExporter:
    exporter_headers = {"Authorization": f"Bearer {api_key}"}
    if headers:
        exporter_headers.update(headers)
    return OTLPSpanExporter(endpoint=endpoint, headers=exporter_headers)


def setup_instrumentation(
    api_key: str,
    endpoint: str,
    resource_attributes: Optional[dict] = None,
) -> TracerProvider:
    provider = create_tracer_provider(resource_attributes)
    provider.add_span_processor(RunIdSpanProcessor())

    base_exporter = create_otlp_exporter(endpoint, api_key)
    fixing_exporter = RunIdFixingExporter(base_exporter)
    batch_processor = TraceBatchSpanProcessor(exporter=fixing_exporter, timeout_seconds=600)

    provider.add_span_processor(batch_processor)
    trace.set_tracer_provider(provider)

    return provider

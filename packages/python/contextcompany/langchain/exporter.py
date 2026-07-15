from typing import Sequence
from opentelemetry.sdk.trace.export import SpanExporter, SpanExportResult
from opentelemetry.sdk.trace import ReadableSpan
from .._utils import _debug
from ..otel.span_copy import copy_span_with_attributes


class RunIdFixingExporter(SpanExporter):
    """Fixes run_id from user metadata before export."""

    def __init__(self, wrapped_exporter: SpanExporter):
        self.wrapped_exporter = wrapped_exporter

    def export(self, spans: Sequence[ReadableSpan]) -> SpanExportResult:
        traces = {}
        attribute_updates: dict[int, dict[str, str]] = {}
        for span in spans:
            trace_id = span.context.trace_id
            if trace_id not in traces:
                traces[trace_id] = []
            traces[trace_id].append(span)

        for trace_id, trace_spans in traces.items():
            root_span = next((s for s in trace_spans if not s.parent), None)
            if not root_span:
                continue

            attributes = root_span.attributes if hasattr(root_span, 'attributes') else {}
            user_run_id = (
                attributes.get("traceloop.association.properties.tcc.runId")
                or attributes.get("traceloop.association.properties.tcc.run_id")
                or attributes.get("langsmith.metadata.tcc.runId")
                or attributes.get("langsmith.metadata.tcc.run_id")
            )

            if user_run_id:
                _debug(f"Fixing runId for trace {trace_id}: {user_run_id}")
                for span in trace_spans:
                    attribute_updates[id(span)] = {"tcc.runId": user_run_id}

        export_spans = [
            copy_span_with_attributes(span, attribute_updates[id(span)])
            if id(span) in attribute_updates
            else span
            for span in spans
        ]

        _debug(f"Exporting {len(export_spans)} spans")
        return self.wrapped_exporter.export(export_spans)

    def shutdown(self) -> None:
        return self.wrapped_exporter.shutdown()

    def force_flush(self, timeout_millis: int = 30000) -> bool:
        return self.wrapped_exporter.force_flush(timeout_millis)

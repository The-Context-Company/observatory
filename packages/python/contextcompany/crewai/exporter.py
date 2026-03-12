"""Exporter wrapper that extracts TCC metadata from CrewAI span attributes.

The Traceloop CrewAI instrumentor stores crew/agent/task data as span
attributes prefixed with ``crewai.*``.  Users may also pass TCC metadata
via ``traceloop.association.properties.*`` or via custom crew input keys.

This exporter inspects root-span attributes for ``tcc.runId`` /
``tcc.sessionId`` and propagates them to every span in the trace so the
TCC backend can read them directly.
"""

from typing import Sequence

from opentelemetry.sdk.trace import ReadableSpan
from opentelemetry.sdk.trace.export import SpanExporter, SpanExportResult
from .._utils import _debug


class MetadataFixingExporter(SpanExporter):
    """Promotes tcc.runId / tcc.sessionId from CrewAI span attributes to top-level attributes.

    The Traceloop instrumentor and LangChain-style metadata both store user
    metadata in ``traceloop.association.properties.*`` span attributes.  If
    the user passed ``tcc.runId`` or ``tcc.sessionId`` through those
    properties (or directly as span attributes), this exporter extracts
    them and writes top-level ``tcc.runId`` / ``tcc.sessionId`` on every
    span in the trace so the TCC backend can read them directly.
    """

    def __init__(self, wrapped_exporter: SpanExporter):
        self.wrapped_exporter = wrapped_exporter

    def export(self, spans: Sequence[ReadableSpan]) -> SpanExportResult:
        # Group spans by trace
        traces: dict[int, list[ReadableSpan]] = {}
        for span in spans:
            trace_id = span.context.trace_id
            if trace_id not in traces:
                traces[trace_id] = []
            traces[trace_id].append(span)

        for trace_id, trace_spans in traces.items():
            root_span = next((s for s in trace_spans if not s.parent), None)
            if not root_span:
                continue

            attrs = root_span.attributes or {}

            # Try multiple known locations for tcc.runId
            user_run_id = (
                attrs.get("traceloop.association.properties.tcc.runId")
                or attrs.get("traceloop.association.properties.tcc.run_id")
                or attrs.get("metadata.tcc.runId")
                or attrs.get("metadata.tcc.run_id")
            )

            # Try multiple known locations for tcc.sessionId
            user_session_id = (
                attrs.get("traceloop.association.properties.tcc.sessionId")
                or attrs.get("traceloop.association.properties.tcc.session_id")
                or attrs.get("metadata.tcc.sessionId")
                or attrs.get("metadata.tcc.session_id")
            )

            # Apply to all spans in the trace
            if user_run_id or user_session_id:
                for span in trace_spans:
                    if hasattr(span, "_attributes"):
                        if user_run_id:
                            span._attributes["tcc.runId"] = user_run_id
                        if user_session_id:
                            span._attributes["tcc.sessionId"] = user_session_id

                if user_run_id:
                    _debug(f"Fixed runId for trace {trace_id}: {user_run_id}")
                if user_session_id:
                    _debug(f"Fixed sessionId for trace {trace_id}: {user_session_id}")

        _debug(f"Exporting {len(spans)} spans")
        return self.wrapped_exporter.export(spans)

    def shutdown(self) -> None:
        return self.wrapped_exporter.shutdown()

    def force_flush(self, timeout_millis: int = 30000) -> bool:
        return self.wrapped_exporter.force_flush(timeout_millis)

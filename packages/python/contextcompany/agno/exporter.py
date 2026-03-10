"""Exporter wrapper that extracts TCC metadata from OpenInference span attributes."""

import json
from typing import Sequence

from opentelemetry.sdk.trace import ReadableSpan
from opentelemetry.sdk.trace.export import SpanExporter, SpanExportResult
from .._utils import _debug


class MetadataFixingExporter(SpanExporter):
    """Promotes tcc.runId / tcc.sessionId from OpenInference metadata to top-level attributes.

    OpenInference stores user metadata as a JSON string in the ``metadata``
    span attribute.  If the user passed ``tcc.runId`` or ``tcc.sessionId``
    via ``using_attributes(metadata=...)``, this exporter extracts those
    values and overwrites the auto-generated ``tcc.runId`` (and sets
    ``tcc.sessionId``) on every span in the trace so the TCC backend can
    read them directly.
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

            # Extract TCC fields from OpenInference metadata JSON
            user_run_id = None
            user_session_id = None

            metadata_raw = attrs.get("metadata")
            if metadata_raw and isinstance(metadata_raw, str):
                try:
                    metadata = json.loads(metadata_raw)
                    user_run_id = metadata.get("tcc.runId") or metadata.get("tcc.run_id")
                    user_session_id = metadata.get("tcc.sessionId") or metadata.get("tcc.session_id")
                except (json.JSONDecodeError, AttributeError):
                    pass

            # Also check session.id (first-class OpenInference attribute)
            if not user_session_id:
                user_session_id = attrs.get("session.id")

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

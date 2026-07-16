"""Helpers for enriching completed OpenTelemetry spans before export."""

from typing import Any, Mapping

from opentelemetry.sdk.trace import ReadableSpan


def copy_span_with_attributes(
    span: ReadableSpan,
    attributes: Mapping[str, Any],
) -> ReadableSpan:
    """Return an export-only copy of ``span`` with merged attributes.

    OpenTelemetry 1.43 makes the SDK's attribute container immutable when a
    span ends. Exporters receive completed ``ReadableSpan`` objects, so they
    must not mutate ``span._attributes``. Constructing a new readable span
    keeps the recorded span untouched while allowing export-time enrichment.
    """

    merged_attributes = dict(span.attributes or {})
    merged_attributes.update(attributes)

    return ReadableSpan(
        name=span.name,
        context=span.context,
        parent=span.parent,
        resource=span.resource,
        attributes=merged_attributes,
        events=span.events,
        links=span.links,
        kind=span.kind,
        status=span.status,
        start_time=span.start_time,
        end_time=span.end_time,
        instrumentation_scope=span.instrumentation_scope,
    )

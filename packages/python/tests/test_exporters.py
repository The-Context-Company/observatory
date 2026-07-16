import json
import unittest

from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import ReadableSpan
from opentelemetry.sdk.trace.export import SpanExporter, SpanExportResult
from opentelemetry.trace import SpanContext, TraceFlags

from contextcompany.agno.exporter import MetadataFixingExporter
from contextcompany.langchain.exporter import RunIdFixingExporter


class RecordingExporter(SpanExporter):
    def __init__(self):
        self.spans = []

    def export(self, spans):
        self.spans = list(spans)
        return SpanExportResult.SUCCESS

    def shutdown(self):
        return None


def make_span(*, trace_id, span_id, parent=None, attributes=None):
    return ReadableSpan(
        name=f"span-{span_id}",
        context=SpanContext(
            trace_id=trace_id,
            span_id=span_id,
            is_remote=False,
            trace_flags=TraceFlags(TraceFlags.SAMPLED),
        ),
        parent=parent,
        resource=Resource.create({}),
        attributes=attributes or {},
        start_time=1,
        end_time=2,
    )


class MetadataFixingExporterTests(unittest.TestCase):
    def test_promotes_agno_metadata_without_mutating_completed_spans(self):
        trace_id = 1
        root = make_span(
            trace_id=trace_id,
            span_id=10,
            attributes={
                "metadata": json.dumps(
                    {
                        "tcc.runId": "11111111-1111-4111-8111-111111111111",
                        "tcc.sessionId": "session-123",
                    }
                )
            },
        )
        child = make_span(
            trace_id=trace_id,
            span_id=11,
            parent=root.context,
            attributes={"existing": "value"},
        )
        wrapped = RecordingExporter()

        result = MetadataFixingExporter(wrapped).export([child, root])

        self.assertEqual(result, SpanExportResult.SUCCESS)
        self.assertNotIn("tcc.runId", root.attributes)
        self.assertNotIn("tcc.runId", child.attributes)
        self.assertEqual(
            wrapped.spans[0].attributes["tcc.runId"],
            "11111111-1111-4111-8111-111111111111",
        )
        self.assertEqual(wrapped.spans[0].attributes["tcc.sessionId"], "session-123")
        self.assertEqual(wrapped.spans[0].attributes["existing"], "value")
        self.assertEqual(
            wrapped.spans[1].attributes["tcc.runId"],
            "11111111-1111-4111-8111-111111111111",
        )

    def test_promotes_openinference_session_id(self):
        root = make_span(
            trace_id=2,
            span_id=20,
            attributes={"session.id": "openinference-session"},
        )
        wrapped = RecordingExporter()

        MetadataFixingExporter(wrapped).export([root])

        self.assertNotIn("tcc.sessionId", root.attributes)
        self.assertEqual(
            wrapped.spans[0].attributes["tcc.sessionId"],
            "openinference-session",
        )


class RunIdFixingExporterTests(unittest.TestCase):
    def test_promotes_langchain_run_id_without_mutating_completed_spans(self):
        run_id = "22222222-2222-4222-8222-222222222222"
        root = make_span(
            trace_id=3,
            span_id=30,
            attributes={"langsmith.metadata.tcc.runId": run_id},
        )
        child = make_span(trace_id=3, span_id=31, parent=root.context)
        wrapped = RecordingExporter()

        result = RunIdFixingExporter(wrapped).export([root, child])

        self.assertEqual(result, SpanExportResult.SUCCESS)
        self.assertNotIn("tcc.runId", root.attributes)
        self.assertNotIn("tcc.runId", child.attributes)
        self.assertEqual(wrapped.spans[0].attributes["tcc.runId"], run_id)
        self.assertEqual(wrapped.spans[1].attributes["tcc.runId"], run_id)


if __name__ == "__main__":
    unittest.main()

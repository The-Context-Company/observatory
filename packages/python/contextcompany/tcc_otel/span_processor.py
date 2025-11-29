import uuid
from typing import Optional

from opentelemetry.sdk.trace import SpanProcessor, ReadableSpan
from opentelemetry.trace import Span
from opentelemetry.context import Context


class LangChainRunIdSpanProcessor(SpanProcessor):
    """Generates temporary run_id and propagates to child spans."""

    def __init__(self):
        self.span_id_to_run_id = {}

    def on_start(self, span: Span, parent_context: Optional[Context] = None) -> None:
        span_id = span.context.span_id
        parent = getattr(span, "parent", None)
        parent_span_id = parent.span_id if parent else None

        if not parent_span_id:
            run_id = str(uuid.uuid4())
            span.set_attribute("tcc.runId", run_id)
            self.span_id_to_run_id[span_id] = run_id
        else:
            run_id = self.span_id_to_run_id.get(parent_span_id)
            if run_id:
                span.set_attribute("tcc.runId", run_id)
                self.span_id_to_run_id[span_id] = run_id

    def on_end(self, span: ReadableSpan) -> None:
        span_id = span.context.span_id
        if span_id in self.span_id_to_run_id:
            del self.span_id_to_run_id[span_id]

    def shutdown(self) -> None:
        pass

    def force_flush(self, timeout_millis: int = 30000) -> bool:
        return True

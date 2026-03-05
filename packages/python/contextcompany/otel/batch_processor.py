from typing import Dict, List, Optional
from opentelemetry.sdk.trace import SpanProcessor, ReadableSpan
from opentelemetry.sdk.trace.export import SpanExporter
from opentelemetry.trace import Span
from opentelemetry.context import Context
import threading


class TraceBatchSpanProcessor(SpanProcessor):
    """Batches spans by trace_id and exports when root span ends."""

    def __init__(self, exporter: SpanExporter, timeout_seconds: int = 600):
        self.exporter = exporter
        self.timeout_seconds = timeout_seconds
        self.batches: Dict[int, List[ReadableSpan]] = {}
        self.batch_timers: Dict[int, threading.Timer] = {}
        self.lock = threading.Lock()
        self.shutdown_flag = False

    def on_start(self, span: Span, parent_context: Optional[Context] = None) -> None:
        pass

    def on_end(self, span: ReadableSpan) -> None:
        if self.shutdown_flag:
            return

        trace_id = span.context.trace_id
        is_root_span = not span.parent

        with self.lock:
            if trace_id not in self.batches:
                self.batches[trace_id] = []
            self.batches[trace_id].append(span)

            if trace_id in self.batch_timers:
                self.batch_timers[trace_id].cancel()

            timer = threading.Timer(self.timeout_seconds, self._timeout_export, args=(trace_id,))
            timer.daemon = True
            timer.start()
            self.batch_timers[trace_id] = timer

            if is_root_span:
                self._export_batch(trace_id)

    def _export_batch(self, trace_id: int) -> None:
        batch = self.batches.get(trace_id)
        if not batch:
            return

        if trace_id in self.batch_timers:
            self.batch_timers[trace_id].cancel()
            del self.batch_timers[trace_id]

        del self.batches[trace_id]

        try:
            self.exporter.export(batch)
        except Exception as e:
            print(f"[TCC] Error exporting batch: {e}")

    def _timeout_export(self, trace_id: int) -> None:
        with self.lock:
            if trace_id in self.batches:
                self._export_batch(trace_id)

    def shutdown(self) -> None:
        self.shutdown_flag = True

        with self.lock:
            for timer in self.batch_timers.values():
                timer.cancel()
            self.batch_timers.clear()

            for trace_id in list(self.batches.keys()):
                self._export_batch(trace_id)

        self.exporter.shutdown()

    def force_flush(self, timeout_millis: int = 30000) -> bool:
        with self.lock:
            for trace_id in list(self.batches.keys()):
                self._export_batch(trace_id)

        return self.exporter.force_flush(timeout_millis)

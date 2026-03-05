"""Generic OpenTelemetry utilities for The Context Company."""

from .batch_processor import TraceBatchSpanProcessor
from .span_processor import RunIdSpanProcessor

__all__ = [
    "TraceBatchSpanProcessor",
    "RunIdSpanProcessor",
]

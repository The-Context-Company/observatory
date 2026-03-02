"""
LiteLLM callback that exports each LLM call to TCC as an OTEL span.

Usage:
    from contextcompany.litellm import TCCCallback
    import litellm

    litellm.callbacks = [TCCCallback()]

    response = litellm.completion(
        model="gpt-4o",
        messages=[...],
        metadata={"tcc.runId": run.run_id},
    )
"""

import json
import atexit

from litellm.integrations.custom_logger import CustomLogger
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.resources import Resource, SERVICE_NAME
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter

class TCCCallback(CustomLogger):
    """Exports each LLM call to TCC as an OTEL span with metadata.tcc.runId."""

    def __init__(self, api_key=None, endpoint=None, service_name="litellm"):
        from ..config import get_api_key, get_url

        api_key = get_api_key(api_key)
        endpoint = endpoint or get_url(
            "https://api.thecontext.company/otel-steps",
            "https://dev.thecontext.company/otel-steps",
        )

        exporter = OTLPSpanExporter(
            endpoint=endpoint,
            headers={"Authorization": f"Bearer {api_key}"},
        )
        self.provider = TracerProvider(
            resource=Resource(attributes={SERVICE_NAME: service_name}),
        )
        self.provider.add_span_processor(BatchSpanProcessor(exporter))
        self.tracer = self.provider.get_tracer("contextcompany.litellm")
        atexit.register(self.provider.shutdown)

    def _get_metadata(self, kwargs):
        return kwargs.get("litellm_params", {}).get("metadata", {}) or {}

    def log_success_event(self, kwargs, response_obj, start_time, end_time):
        metadata = self._get_metadata(kwargs)
        usage = getattr(response_obj, "usage", None)
        choices = getattr(response_obj, "choices", [])

        span = self.tracer.start_span(
            name="litellm_request",
            start_time=int(start_time.timestamp() * 1e9),
        )

        # Run ID
        run_id = metadata.get("tcc.runId") or metadata.get("tcc.run_id")
        if run_id:
            span.set_attribute("metadata.tcc.runId", run_id)

        # Model
        span.set_attribute("gen_ai.request.model", kwargs.get("model", ""))
        span.set_attribute("gen_ai.response.model", getattr(response_obj, "model", ""))

        # Tokens
        if usage:
            span.set_attribute("gen_ai.usage.input_tokens", getattr(usage, "prompt_tokens", 0))
            span.set_attribute("gen_ai.usage.output_tokens", getattr(usage, "completion_tokens", 0))

        # Messages
        messages = kwargs.get("messages")
        if messages:
            span.set_attribute("gen_ai.input.messages", json.dumps(messages))

        if choices:
            msg = getattr(choices[0], "message", None)
            if msg:
                out = {"role": getattr(msg, "role", "assistant")}
                if getattr(msg, "content", None):
                    out["content"] = msg.content
                if getattr(msg, "tool_calls", None):
                    out["tool_calls"] = [
                        {"id": tc.id, "function": {"name": tc.function.name, "arguments": tc.function.arguments}}
                        for tc in msg.tool_calls
                    ]
                span.set_attribute("gen_ai.output.messages", json.dumps([out]))

            span.set_attribute("gen_ai.response.finish_reasons",
                               json.dumps([getattr(choices[0], "finish_reason", "stop")]))

        span.end(end_time=int(end_time.timestamp() * 1e9))

    def log_failure_event(self, kwargs, response_obj, start_time, end_time):
        metadata = self._get_metadata(kwargs)

        span = self.tracer.start_span(
            name="litellm_request",
            start_time=int(start_time.timestamp() * 1e9),
        )

        run_id = metadata.get("tcc.runId") or metadata.get("tcc.run_id")
        if run_id:
            span.set_attribute("metadata.tcc.runId", run_id)

        span.set_attribute("gen_ai.request.model", kwargs.get("model", ""))
        span.set_status(trace.StatusCode.ERROR, str(response_obj))
        span.end(end_time=int(end_time.timestamp() * 1e9))

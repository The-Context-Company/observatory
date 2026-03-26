import type { Context } from "@opentelemetry/api";
import type {
  ReadableSpan,
  Span,
  SpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { RuntimeBatchTransport } from "./transport.js";
import { buildBatchPayload, debugLog, getSpanKind } from "./utils.js";

type InvocationState = {
  traceId: string;
  spans: Map<string, ReadableSpan>;
  rootSpan?: ReadableSpan;
  exportPromise?: Promise<void>;
};

type ProcessorConfig = {
  debug: boolean;
  transport: RuntimeBatchTransport;
};

export class RuntimeAISDKSpanProcessor implements SpanProcessor {
  private readonly debugEnabled: boolean;
  private readonly transport: RuntimeBatchTransport;
  private readonly spanToRoot = new Map<string, string>();
  private readonly invocations = new Map<string, InvocationState>();

  constructor(config: ProcessorConfig) {
    this.debugEnabled = config.debug;
    this.transport = config.transport;
  }

  onStart(span: Span, _parentContext: Context): void {
    const spanKind = getSpanKind(span);
    if (spanKind === "unknown") return;

    const spanId = span.spanContext().spanId;

    if (spanKind === "run") {
      this.spanToRoot.set(spanId, spanId);
      this.ensureInvocation(spanId, span.spanContext().traceId);
      debugLog(this.debugEnabled, "Registered AI SDK run span", {
        spanId,
        traceId: span.spanContext().traceId,
      });
      return;
    }

    const parentSpanId = span.parentSpanContext?.spanId;
    if (parentSpanId === undefined) {
      debugLog(this.debugEnabled, "Skipping orphan AI SDK span", {
        spanId,
        name: span.name,
      });
      return;
    }

    const rootSpanId = this.spanToRoot.get(parentSpanId);
    if (rootSpanId === undefined) {
      debugLog(this.debugEnabled, "Skipping AI SDK span without root mapping", {
        spanId,
        name: span.name,
        parentSpanId,
      });
      return;
    }

    this.spanToRoot.set(spanId, rootSpanId);
    this.ensureInvocation(rootSpanId, span.spanContext().traceId);
  }

  onEnd(span: ReadableSpan): void {
    const spanKind = getSpanKind(span);
    if (spanKind === "unknown") return;

    const spanId = span.spanContext().spanId;
    const rootSpanId =
      spanKind === "run" ? spanId : this.spanToRoot.get(spanId) ?? undefined;

    if (rootSpanId === undefined) {
      debugLog(this.debugEnabled, "Finished AI SDK span has no root mapping", {
        spanId,
        name: span.name,
      });
      return;
    }

    const invocation = this.ensureInvocation(
      rootSpanId,
      span.spanContext().traceId
    );
    invocation.spans.set(spanId, span);

    if (spanKind === "run") {
      invocation.rootSpan = span;
      void this.exportInvocation(rootSpanId);
    }
  }

  async forceFlush(): Promise<void> {
    const exports: Promise<void>[] = [];

    for (const [rootSpanId, invocation] of this.invocations.entries()) {
      if (invocation.rootSpan !== undefined) {
        exports.push(this.exportInvocation(rootSpanId));
      }
    }

    await Promise.all(exports);
    await this.transport.flush();
  }

  async shutdown(): Promise<void> {
    await this.forceFlush();
  }

  private ensureInvocation(rootSpanId: string, traceId: string): InvocationState {
    const existing = this.invocations.get(rootSpanId);
    if (existing !== undefined) return existing;

    const created: InvocationState = {
      traceId,
      spans: new Map(),
    };
    this.invocations.set(rootSpanId, created);
    return created;
  }

  private exportInvocation(rootSpanId: string): Promise<void> {
    const invocation = this.invocations.get(rootSpanId);
    if (invocation === undefined) return Promise.resolve();
    if (invocation.exportPromise !== undefined) return invocation.exportPromise;
    if (invocation.rootSpan === undefined) return Promise.resolve();

    const spans = [...invocation.spans.values()];
    const payload = buildBatchPayload(invocation.rootSpan, spans);

    debugLog(this.debugEnabled, "Exporting AI SDK invocation", {
      rootSpanId,
      traceId: invocation.traceId,
      items: payload.items.length,
    });

    const exportPromise = this.transport.send(payload).finally(() => {
      for (const spanId of invocation.spans.keys()) {
        this.spanToRoot.delete(spanId);
      }
      this.spanToRoot.delete(rootSpanId);
      this.invocations.delete(rootSpanId);
    });

    invocation.exportPromise = exportPromise;
    return exportPromise;
  }
}

import {
  SpanProcessor,
  type ReadableSpan,
  type Span,
} from "@opentelemetry/sdk-trace-base";
import { getRunIdFromSpanMetadata, getSpanType } from "./utils";
import { Context } from "@opentelemetry/api";
import { debug } from "./internal/logger";
import type { OTLPHttpJsonTraceExporter } from "./exporters/json/OTLPHttpJsonTraceExporter";

// we use the spanId of a "run" span type as the batchId
type RunId = string;
type Batch = ReadableSpan[];

export class RunBatchSpanProcessor implements SpanProcessor {
  private shutdownOnce = { isCalled: false };

  private spanIdToRunId = new Map<string, string>();

  private batches = new Map<RunId, Batch>();
  private batchTimeouts = new Map<RunId, NodeJS.Timeout>();

  private exporter: OTLPHttpJsonTraceExporter;

  constructor(exporter: OTLPHttpJsonTraceExporter) {
    this.exporter = exporter;
  }

  onStart(span: Span, _parentContext: Context): void {
    const spanType = getSpanType(span);
    if (spanType === "unknown") {
      debug(`Unknown span type ${span.name}`);
      return;
    }

    if (spanType === "run") {
      const spanId = span.spanContext().spanId;
      const runId = getRunIdFromSpanMetadata(span) ?? crypto.randomUUID();

      span.setAttribute("tcc.runId", runId);
      this.spanIdToRunId.set(spanId, runId);
    } else {
      // parent is either a run or a step
      const parentSpanId = span.parentSpanContext?.spanId;
      if (!parentSpanId) {
        debug(`Step span ${span.spanContext().spanId} has no parent span id`);
        return;
      }

      const runId = this.spanIdToRunId.get(parentSpanId);
      if (!runId) {
        debug(`Span with id ${span.spanContext().spanId} has no parent run id`);
        return;
      }

      if (spanType === "step") {
        this.spanIdToRunId.set(span.spanContext().spanId, runId);
      }

      span.setAttribute("tcc.runId", runId);
    }
  }

  onEnd(span: ReadableSpan): void {
    const spanType = getSpanType(span);

    if (spanType === "unknown") {
      debug(`Unknown span type ${span.name}`);
      return;
    }

    if (spanType === "run") {
      const spanId = span.spanContext().spanId;
      const runId = this.spanIdToRunId.get(spanId);
      if (!runId) return;

      this.addToBatch(runId, span);

      // immediately export batch if the run span ends
      this.exportBatch(runId);
    } else {
      const parentSpanId = span.parentSpanContext?.spanId;
      if (!parentSpanId) {
        debug(`Step span ${span.spanContext().spanId} has no parent span id`);
        return;
      }

      const runId = this.spanIdToRunId.get(parentSpanId);
      if (!runId) return;

      this.addToBatch(runId, span);
    }
  }

  async shutdown(): Promise<void> {
    this.shutdownOnce.isCalled = true;
    await this.forceFlush();
    return this.exporter.shutdown();
  }

  forceFlush(): Promise<void> {
    for (const runId of this.batches.keys()) this.exportBatch(runId);

    return this.exporter.forceFlush();
  }

  private addToBatch(runId: string, span: ReadableSpan) {
    const batch = this.batches.get(runId);
    if (batch) batch.push(span);
    else this.batches.set(runId, [span]);

    // reset timeout for this batch
    const existingTimeout = this.batchTimeouts.get(runId);
    if (existingTimeout) clearTimeout(existingTimeout);

    const timeout = setTimeout(() => {
      this.exportBatch(runId);
    }, 600000); // 10 minutes
    this.batchTimeouts.set(runId, timeout);
  }

  private exportBatch(runId: string) {
    const batch = this.batches.get(runId);
    if (!batch) {
      debug(`RunBatchSpanProcessor: Batch ${runId} not found`);
      return;
    }

    const timeout = this.batchTimeouts.get(runId);
    if (timeout) clearTimeout(timeout);

    this.batches.delete(runId);
    this.batchTimeouts.delete(runId);

    for (const span of batch) {
      const spanId = span.spanContext().spanId;
      this.spanIdToRunId.delete(spanId);
    }

    debug(`RunBatchSpanProcessor: Sending batch ${runId} to exporter`);
    this.exporter.export(batch, (_result) => {});
  }
}

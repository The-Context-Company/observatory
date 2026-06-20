import { Context } from "@opentelemetry/api";
import {
  SpanProcessor,
  type ReadableSpan,
  type Span,
} from "@opentelemetry/sdk-trace-base";
import type { OTLPHttpJsonTraceExporter } from "./exporters/json/OTLPHttpJsonTraceExporter";
import { debug } from "./internal/logger";
import { getRunIdFromSpanMetadata, getSpanType } from "./utils";

// we use the spanId of a "run" span type as the batchId
type RunId = string;
type Batch = ReadableSpan[];

type RunBatchSpanProcessorOptions = {
  maxActiveBatches?: number;
  maxSpansPerBatch?: number;
  maxQueuedSpans?: number;
  batchTimeoutMs?: number;
};

export class RunBatchSpanProcessor implements SpanProcessor {
  private shutdownOnce = { isCalled: false };

  private spanIdToRunId = new Map<string, string>();

  private batches = new Map<RunId, Batch>();
  private batchTimeouts = new Map<RunId, NodeJS.Timeout>();
  private queuedSpanCount = 0;

  private exporter: OTLPHttpJsonTraceExporter;
  private readonly maxActiveBatches: number;
  private readonly maxSpansPerBatch: number;
  private readonly maxQueuedSpans: number;
  private readonly batchTimeoutMs: number;

  constructor(
    exporter: OTLPHttpJsonTraceExporter,
    options: RunBatchSpanProcessorOptions = {}
  ) {
    this.exporter = exporter;
    this.maxActiveBatches = options.maxActiveBatches ?? 1000;
    this.maxSpansPerBatch = options.maxSpansPerBatch ?? 1000;
    this.maxQueuedSpans = options.maxQueuedSpans ?? 10000;
    this.batchTimeoutMs = options.batchTimeoutMs ?? 600000;
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
    let batch = this.batches.get(runId);
    if (!batch) {
      this.evictOldestBatchesIfNeeded();
      batch = [];
      this.batches.set(runId, batch);
    }

    const isRunSpan = getSpanType(span) === "run";
    if (batch.length >= this.maxSpansPerBatch && !isRunSpan) {
      debug(
        `RunBatchSpanProcessor: Dropping span for oversized batch ${runId}`
      );
      return;
    }

    if (this.queuedSpanCount >= this.maxQueuedSpans) {
      this.evictOldestBatch();
      batch = this.batches.get(runId);
      if (!batch) {
        debug(
          `RunBatchSpanProcessor: Batch ${runId} was evicted, dropping span`
        );
        return;
      }
    }

    batch.push(span);
    this.queuedSpanCount++;

    // reset timeout for this batch
    const existingTimeout = this.batchTimeouts.get(runId);
    if (existingTimeout) clearTimeout(existingTimeout);

    const timeout = setTimeout(() => {
      this.exportBatch(runId);
    }, this.batchTimeoutMs);
    this.batchTimeouts.set(runId, timeout);
  }

  private evictOldestBatchesIfNeeded() {
    while (this.batches.size >= this.maxActiveBatches) {
      this.evictOldestBatch();
    }
  }

  private evictOldestBatch() {
    const oldestRunId = this.batches.keys().next().value as string | undefined;
    if (!oldestRunId) return;

    const batch = this.batches.get(oldestRunId);
    const timeout = this.batchTimeouts.get(oldestRunId);
    if (timeout) clearTimeout(timeout);

    if (batch) {
      this.queuedSpanCount = Math.max(0, this.queuedSpanCount - batch.length);
      for (const span of batch) {
        this.spanIdToRunId.delete(span.spanContext().spanId);
      }
    }

    this.batches.delete(oldestRunId);
    this.batchTimeouts.delete(oldestRunId);
    debug(`RunBatchSpanProcessor: Dropped oldest batch ${oldestRunId}`);
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
    this.queuedSpanCount = Math.max(0, this.queuedSpanCount - batch.length);

    for (const span of batch) {
      const spanId = span.spanContext().spanId;
      this.spanIdToRunId.delete(spanId);
    }

    debug(`RunBatchSpanProcessor: Sending batch ${runId} to exporter`);
    this.exporter.export(batch, (_result) => {});
  }
}

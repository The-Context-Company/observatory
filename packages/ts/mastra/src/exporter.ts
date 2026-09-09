import {
  type AnyExportedSpan,
  type InitExporterOptions,
  type ObservabilityExporter,
  type TracingEvent,
  TracingEventType,
} from "@mastra/core/observability";
import { randomUUID } from "crypto";
import { getTCCApiKey, getTCCUrl } from "@contextcompany/api";
import type { TCCMastraExporterConfig } from "./types";

export class TCCMastraExporter implements ObservabilityExporter {
  name = "tcc-mastra-exporter";
  private apiKey: string;
  private endpoint: string;
  private debug: boolean;
  private traces = new Map<string, AnyExportedSpan[]>(); // traceId -> spans
  private runIds = new Map<string, string>(); // traceId -> runId
  private metadata = new Map<string, Record<string, any>>(); // traceId -> custom metadata
  private inflight = new Set<Promise<void>>(); // export requests not yet settled

  constructor(config: TCCMastraExporterConfig = {}) {
    const apiKey = config.apiKey || getTCCApiKey();
    if (!apiKey) {
      throw new Error(
        "Missing API key: set TCC_API_KEY as an environment variable or provide apiKey in TCCMastraExporter"
      );
    }

    this.apiKey = apiKey;
    this.endpoint =
      config.endpoint ||
      getTCCUrl("/v1/mastra", apiKey);
    this.debug = config.debug || false;
  }

  async exportTracingEvent(event: TracingEvent): Promise<void> {
    const { exportedSpan } = event;

    switch (event.type) {
      case TracingEventType.SPAN_STARTED:
        this.handleSpanStarted(exportedSpan);
        break;
      case TracingEventType.SPAN_ENDED:
        await this.handleSpanEnded(exportedSpan);
        break;
      case TracingEventType.SPAN_UPDATED:
        this.handleSpanUpdated(exportedSpan);
        break;
    }
  }

  private handleSpanStarted(span: AnyExportedSpan): void {
    if (!this.traces.has(span.traceId)) {
      this.traces.set(span.traceId, []);
    }

    // Extract TCC run ID and metadata from root span
    if (span.isRootSpan && !this.runIds.has(span.traceId)) {
      const tccRunId = span.metadata?.["tcc.runId"] as string | undefined;
      const runId = tccRunId || randomUUID();
      this.runIds.set(span.traceId, runId);

      if (span.metadata) {
        this.metadata.set(span.traceId, { ...span.metadata });
      }

      if (this.debug) {
        console.log(`[TCC] Run ID ${runId} for trace ${span.traceId}`);
        if (span.metadata) {
          console.log(`[TCC] Metadata:`, span.metadata);
        }
      }
    }

    this.traces.get(span.traceId)!.push(span);

    if (this.debug) {
      console.log(`[TCC] Started ${span.type} span: ${span.name}`);
    }
  }

  private async handleSpanEnded(span: AnyExportedSpan): Promise<void> {
    this.updateSpanInBatch(span);

    if (this.debug) {
      console.log(`[TCC] Ended ${span.type} span: ${span.name}`);
    }

    // Export all spans when root span ends
    if (span.isRootSpan) {
      await this.exportTrace(span.traceId);
    }
  }

  private handleSpanUpdated(span: AnyExportedSpan): void {
    this.updateSpanInBatch(span);
  }

  private updateSpanInBatch(span: AnyExportedSpan): void {
    const trace = this.traces.get(span.traceId);
    if (trace) {
      const index = trace.findIndex((s) => s.id === span.id);
      if (index >= 0) {
        trace[index] = span;
      }
    }
  }

  private exportTrace(traceId: string): Promise<void> {
    const request = this.sendTrace(traceId).finally(() => {
      this.inflight.delete(request);
    });
    this.inflight.add(request);
    return request;
  }

  private async sendTrace(traceId: string): Promise<void> {
    const spans = this.traces.get(traceId);
    const runId = this.runIds.get(traceId);
    const metadata = this.metadata.get(traceId) || {};

    // Dequeue synchronously so a concurrent flush()/shutdown() cannot export
    // the same trace twice while this request is in flight.
    this.traces.delete(traceId);
    this.runIds.delete(traceId);
    this.metadata.delete(traceId);

    if (!spans || spans.length === 0) return;

    try {
      const payload = {
        runId,
        traceId,
        framework: "mastra",
        metadata,
        spans: spans.map((span) => ({ ...span, runId })),
      };

      if (this.debug) {
        console.log(`[TCC] Exporting ${spans.length} spans for run ${runId}`);
        console.log(`[TCC] Payload:`, JSON.stringify(payload, null, 2));
      }

      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error(
          `[TCC] Failed to export: ${response.status} ${response.statusText}`,
          text
        );
      } else if (this.debug) {
        console.log(`[TCC] Successfully exported run ${runId}`);
      }
    } catch (error) {
      console.error(`[TCC] Export error:`, error);
    }
  }

  /**
   * Export any traces that have not yet completed and wait for all in-flight
   * export requests to settle. Call this before a serverless function returns
   * so traces are delivered before the runtime is frozen.
   */
  async flush(): Promise<void> {
    for (const traceId of [...this.traces.keys()]) {
      await this.exportTrace(traceId);
    }
    await Promise.all([...this.inflight]);
  }

  async shutdown(): Promise<void> {
    await this.flush();
  }

  init(options: InitExporterOptions): void {
    if (this.debug) {
      console.log(
        `[TCC] Initialized for service: ${options.config?.serviceName ?? "unknown"}`
      );
      console.log(`[TCC] Endpoint: ${this.endpoint}`);
    }
  }
}

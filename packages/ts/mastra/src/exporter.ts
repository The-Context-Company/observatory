import {
  AITracingExporter,
  AITracingEvent,
  AITracingEventType,
  AnyExportedAISpan,
  TracingConfig,
} from "@mastra/core/ai-tracing";
import { randomUUID } from "crypto";
import { getTCCApiKey, getTCCUrl } from "@contextcompany/api";
import type { TCCMastraExporterConfig } from "./types";

export class TCCMastraExporter implements AITracingExporter {
  name = "tcc-mastra-exporter";
  private apiKey: string;
  private endpoint: string;
  private debug: boolean;
  private traces = new Map<string, AnyExportedAISpan[]>(); // traceId -> spans
  private runIds = new Map<string, string>(); // traceId -> runId
  private metadata = new Map<string, Record<string, any>>(); // traceId -> custom metadata

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
      getTCCUrl(
        apiKey,
        "https://api.thecontext.company/v1/mastra",
        "https://dev.thecontext.company/v1/mastra"
      );
    this.debug = config.debug || false;
  }

  async exportEvent(event: AITracingEvent): Promise<void> {
    const { exportedSpan } = event;

    switch (event.type) {
      case AITracingEventType.SPAN_STARTED:
        this.handleSpanStarted(exportedSpan);
        break;
      case AITracingEventType.SPAN_ENDED:
        await this.handleSpanEnded(exportedSpan);
        break;
      case AITracingEventType.SPAN_UPDATED:
        this.handleSpanUpdated(exportedSpan);
        break;
    }
  }

  private handleSpanStarted(span: AnyExportedAISpan): void {
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

  private async handleSpanEnded(span: AnyExportedAISpan): Promise<void> {
    this.updateSpanInBatch(span);

    if (this.debug) {
      console.log(`[TCC] Ended ${span.type} span: ${span.name}`);
    }

    // Export all spans when root span ends
    if (span.isRootSpan) {
      await this.exportTrace(span.traceId);
    }
  }

  private handleSpanUpdated(span: AnyExportedAISpan): void {
    this.updateSpanInBatch(span);
  }

  private updateSpanInBatch(span: AnyExportedAISpan): void {
    const trace = this.traces.get(span.traceId);
    if (trace) {
      const index = trace.findIndex((s) => s.id === span.id);
      if (index >= 0) {
        trace[index] = span;
      }
    }
  }

  private async exportTrace(traceId: string): Promise<void> {
    const spans = this.traces.get(traceId);
    const runId = this.runIds.get(traceId);
    const metadata = this.metadata.get(traceId) || {};

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
    } finally {
      this.traces.delete(traceId);
      this.runIds.delete(traceId);
      this.metadata.delete(traceId);
    }
  }

  async shutdown(): Promise<void> {
    for (const traceId of this.traces.keys()) {
      await this.exportTrace(traceId);
    }
  }

  init(config: TracingConfig): void {
    if (this.debug) {
      console.log(`[TCC] Initialized for service: ${config.serviceName}`);
      console.log(`[TCC] Endpoint: ${this.endpoint}`);
    }
  }
}

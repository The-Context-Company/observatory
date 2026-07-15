import { getTCCApiKey, getTCCUrl } from "@contextcompany/api";
import type { Context } from "@opentelemetry/api";
import {
  type ReadableSpan,
  type Span,
  type SpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { OTLPHttpJsonTraceExporter } from "./exporters/json/OTLPHttpJsonTraceExporter";
import { debug, setDebug } from "./internal/logger";
import { RunBatchSpanProcessor } from "./RunBatchSpanProcessor";
import { isAISDKSpan } from "./utils";

export type TCCSpanProcessorOptions = {
  apiKey?: string;
  otlpUrl?: string;
  baseProcessor?: SpanProcessor;
  debug?: boolean;
};

export class TCCSpanProcessor implements SpanProcessor {
  private readonly processor: SpanProcessor;

  constructor(options: TCCSpanProcessorOptions = {}) {
    if (options.debug) setDebug(options.debug);

    const apiKey = options.apiKey || getTCCApiKey();
    if (!apiKey)
      throw new Error(
        "Missing API key: set TCC_API_KEY as an environment variable or provide apiKey in TCCSpanProcessor"
      );

    const url = options.otlpUrl ?? getTCCUrl("/v1/traces", apiKey);

    debug(`Using OTLP URL: ${url}`);

    const exporter = new OTLPHttpJsonTraceExporter({
      url,
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    const baseProcessor =
      options.baseProcessor ?? new RunBatchSpanProcessor(exporter);

    this.processor = new AISDKSpanProcessor(baseProcessor);
  }

  onStart(span: Span, parentContext: Context): void {
    this.processor.onStart(span, parentContext);
  }

  onEnd(span: ReadableSpan): void {
    this.processor.onEnd(span);
  }

  shutdown(): Promise<void> {
    return this.processor.shutdown();
  }

  forceFlush(): Promise<void> {
    return this.processor.forceFlush();
  }
}

export class AISDKSpanProcessor implements SpanProcessor {
  constructor(private readonly processor: SpanProcessor) {}

  onStart(span: Span, parentContext: Context): void {
    if (isAISDKSpan(span)) {
      // AI SDK 7 replaces telemetry metadata with explicitly included runtime
      // context. Mirror those attributes to the existing metadata namespace so
      // downstream TCC metadata handling remains backwards compatible.
      for (const [key, value] of Object.entries(span.attributes)) {
        const prefix = "ai.settings.context.";
        if (key.startsWith(prefix) && value !== undefined) {
          span.setAttribute(
            `ai.telemetry.metadata.${key.slice(prefix.length)}`,
            value
          );
        }
      }

      debug(`Began AI SDK span: ${span.name}`);
      this.processor.onStart(span, parentContext);
    }
  }

  onEnd(span: ReadableSpan): void {
    if (span && isAISDKSpan(span)) {
      debug(`Ended AI SDK span: ${span.name}`);
      this.processor.onEnd(span);
    }
  }

  shutdown(): Promise<void> {
    return this.processor.shutdown();
  }

  forceFlush(): Promise<void> {
    return this.processor.forceFlush();
  }
}

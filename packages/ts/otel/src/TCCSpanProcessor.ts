import type { Context } from "@opentelemetry/api";
import {
  type SpanProcessor,
  type ReadableSpan,
  type Span,
} from "@opentelemetry/sdk-trace-base";
import { getTCCApiKey, getTCCUrl } from "@contextcompany/api";
import { OTLPHttpJsonTraceExporter } from "./exporters/json/OTLPHttpJsonTraceExporter";
import { debug, setDebug } from "./internal/logger";
import { RunBatchSpanProcessor } from "./RunBatchSpanProcessor";

type TCCSpanProcessorOptions = {
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

    const url = options.otlpUrl ?? getTCCUrl(
      apiKey,
      "https://api.thecontext.company/v1/traces",
      "https://dev.thecontext.company/v1/traces"
    );

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
    if (span.name.startsWith("ai.")) {
      debug(`Began AI SDK span: ${span.name}`);
      this.processor.onStart(span, parentContext);
    }
  }

  onEnd(span: ReadableSpan): void {
    if (span && span.name.startsWith("ai.")) {
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

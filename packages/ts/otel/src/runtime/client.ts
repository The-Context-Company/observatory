import type { Tracer } from "@opentelemetry/api";
import { BasicTracerProvider } from "@opentelemetry/sdk-trace-base";
import { RuntimeAISDKSpanProcessor } from "./processor.js";
import { RuntimeBatchTransport } from "./transport.js";
import type {
  AISDKCallOptions,
  TCCAISDKTelemetryConfig,
  TCCExperimentalTelemetry,
  TCCMetadata,
} from "./types.js";

export class TCCAISDKTelemetry {
  readonly tracer: Tracer;

  private readonly defaultMetadata?: TCCMetadata;
  private readonly processor: RuntimeAISDKSpanProcessor;

  constructor(config: TCCAISDKTelemetryConfig) {
    const transport = new RuntimeBatchTransport(config);
    this.processor = new RuntimeAISDKSpanProcessor({
      debug: config.debug === true,
      transport,
    });

    const tracerProvider = new BasicTracerProvider({
      spanProcessors: [this.processor],
    });

    this.tracer = tracerProvider.getTracer(
      config.tracerName ?? "@contextcompany/otel/runtime",
      config.tracerVersion
    );
    this.defaultMetadata = config.metadata;
  }

  telemetry(
    telemetry: TCCExperimentalTelemetry = {}
  ): TCCExperimentalTelemetry {
    const metadata = mergeMetadata(this.defaultMetadata, telemetry.metadata);

    return {
      ...telemetry,
      isEnabled: true,
      tracer: this.tracer,
      ...(metadata !== undefined ? { metadata } : {}),
    };
  }

  instrument<T extends AISDKCallOptions>(options: T): T {
    const onFinish = options.onFinish;

    return {
      ...options,
      experimental_telemetry: this.telemetry(options.experimental_telemetry),
      onFinish: async (...args: readonly unknown[]) => {
        try {
          await onFinish?.(...args);
        } finally {
          await this.flush();
        }
      },
    };
  }

  flush(): Promise<void> {
    return this.processor.forceFlush();
  }

  shutdown(): Promise<void> {
    return this.processor.shutdown();
  }
}

export function createTCCAISDKTelemetry(
  config: TCCAISDKTelemetryConfig
): TCCAISDKTelemetry {
  return new TCCAISDKTelemetry(config);
}

function mergeMetadata(
  defaults: TCCMetadata | undefined,
  overrides: TCCMetadata | undefined
): TCCMetadata | undefined {
  if (defaults === undefined && overrides === undefined) {
    return undefined;
  }

  return {
    ...(defaults ?? {}),
    ...(overrides ?? {}),
  };
}

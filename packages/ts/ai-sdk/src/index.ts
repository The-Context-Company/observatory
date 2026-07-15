import {
  TCCSpanProcessor,
  type TCCSpanProcessorOptions,
} from "@contextcompany/otel";
import { NodeSDK, type NodeSDKConfiguration } from "@opentelemetry/sdk-node";
import {
  registerAISDKTelemetry,
  type TCCTelemetryIntegrationOptions,
} from "./telemetry";

export * from "./telemetry";
export { submitFeedback } from "@contextcompany/otel";

const NODE_REGISTRATION_KEY = Symbol.for("@contextcompany/ai-sdk.node");

export type RegisterTCCOptions = TCCSpanProcessorOptions & {
  telemetry?: TCCTelemetryIntegrationOptions;
  nodeSDK?: Omit<NodeSDKConfiguration, "spanProcessors">;
};

export type TCCRegistration = {
  forceFlush(): Promise<void>;
  shutdown(): Promise<void>;
};

export function registerTCC(options: RegisterTCCOptions = {}): TCCRegistration {
  const state = globalThis as any;
  const existing = state[NODE_REGISTRATION_KEY];
  if (existing) return existing;

  const { telemetry, nodeSDK, ...processorOptions } = options;
  const processor = new TCCSpanProcessor(processorOptions);
  const sdk = new NodeSDK({
    ...nodeSDK,
    spanProcessors: [processor],
  });
  sdk.start();
  registerAISDKTelemetry(telemetry);

  let shutdownPromise: Promise<void> | undefined;
  const registration: TCCRegistration = {
    forceFlush: () => processor.forceFlush(),
    shutdown: () => (shutdownPromise ??= sdk.shutdown()),
  };
  state[NODE_REGISTRATION_KEY] = registration;
  return registration;
}

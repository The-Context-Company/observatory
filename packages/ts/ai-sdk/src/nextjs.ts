import {
  registerOTelTCC,
  type RegisterOpts,
} from "@contextcompany/otel/nextjs";
import {
  registerAISDKTelemetry,
  type TCCTelemetryIntegrationOptions,
} from "./telemetry";

export { tccTelemetry } from "./telemetry";
export { submitFeedback } from "@contextcompany/otel";
export type { TCCTelemetryConfig, TCCTelemetryOptions } from "./telemetry";

const NEXT_REGISTRATION_KEY = Symbol.for("@contextcompany/ai-sdk.nextjs");

export type RegisterTCCOptions = RegisterOpts & {
  telemetry?: TCCTelemetryIntegrationOptions;
};

export function registerTCC(options: RegisterTCCOptions = {}) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const state = globalThis as any;
  if (state[NEXT_REGISTRATION_KEY]) {
    return state[NEXT_REGISTRATION_KEY].registration;
  }

  const { telemetry, ...otelOptions } = options;
  const registration = registerOTelTCC(otelOptions);
  registerAISDKTelemetry(telemetry);
  state[NEXT_REGISTRATION_KEY] = { registration };
  return registration;
}

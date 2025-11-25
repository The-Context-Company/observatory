import { type SpanProcessor } from "@opentelemetry/sdk-trace-base";
import { type Configuration, registerOTel } from "@vercel/otel";
import { getTCCApiKey, getTCCUrl } from "@contextcompany/api";
import { TCCSpanProcessor } from "../TCCSpanProcessor";
import { tccLocalSpanProcessor } from "./local/runtime";
import { startWebSocketServer } from "./local/ws";
import { debug, setDebug } from "../internal/logger";
import {
  captureAnonymousEvent,
  initAnonymousTelemetry,
} from "./telemetry/posthog";

export type RegisterOpts = {
  url?: string;
  apiKey?: string;
  baseProcessor?: SpanProcessor;
  config?: Partial<Configuration>;
  debug?: boolean;
  local?: boolean;
};

export function registerOTelTCC(opts: RegisterOpts = {}) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (opts.debug) setDebug(true);

  const spanProcessors = [];

  const apiKey = opts.apiKey ?? getTCCApiKey();

  if (opts.local) {
    initAnonymousTelemetry();
    captureAnonymousEvent({
      event: "local_mode_start",
    });

    startWebSocketServer();
    spanProcessors.push(tccLocalSpanProcessor());
    // if `local` is true and no apiKey is provided, assume the user just wants to run local mode
    if (!apiKey) {
      debug(`Using environments: ["local"].`);
      return registerOTel({
        spanProcessors,
        ...opts.config,
      });
    }
  }

  if (!apiKey)
    throw new Error(
      "TCC: Missing API key. Set TCC_API_KEY as an environment variable or provide apiKey in registerOTelTCC"
    );

  const url = opts.url ?? getTCCUrl(
    apiKey,
    "https://api.thecontext.company/v1/traces",
    "https://dev.thecontext.company/v1/traces"
  );

  const isProduction = url === "https://api.thecontext.company/v1/traces";

  // TODO: have an `skipWarnings` flag for edge cases?
  if (apiKey.startsWith("dev_") && isProduction)
    throw new Error("TCC: Dev API Key detected but using production endpoint");

  if (opts.local && isProduction)
    throw new Error(
      "TCC: Production API Key detected while local mode is enabled"
    );

  const environments = [];
  if (opts.local) environments.push("local");
  if (isProduction) environments.push("production");
  else environments.push("development");
  debug(`Using environments: ["${environments.join('", "')}"].`);

  const tccSpanProcessor = new TCCSpanProcessor({
    apiKey,
    otlpUrl: url,
    baseProcessor: opts.baseProcessor,
    debug: opts.debug,
  });
  spanProcessors.push(tccSpanProcessor);

  return registerOTel({
    spanProcessors,
    ...opts.config,
  });
}

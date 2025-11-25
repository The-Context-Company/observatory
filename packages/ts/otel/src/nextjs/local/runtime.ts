import { LocalSpanExporter } from "./LocalSpanExporter";
import { AISDKSpanProcessor } from "../../TCCSpanProcessor";
import { SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";

// TODO: should/can we not export this if not in local mode?

// Ensure a single exporter instance across HMR / multiple imports
const g = globalThis as unknown as {
  __TCC_LOCAL_EXPORTER__?: LocalSpanExporter;
};

export const tccLocalExporter =
  g.__TCC_LOCAL_EXPORTER__ ??
  (g.__TCC_LOCAL_EXPORTER__ = new LocalSpanExporter());

export const tccLocalSpanProcessor = () =>
  new AISDKSpanProcessor(new SimpleSpanProcessor(tccLocalExporter));

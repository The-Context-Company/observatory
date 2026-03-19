/**
 * @contextcompany/openclaw — OpenClaw integration via OpenTelemetry.
 *
 * This package provides a lightweight OTLP collector that receives traces
 * from OpenClaw's built-in `diagnostics-otel` plugin, maps them to
 * The Context Company's format, and forwards them to the TCC API.
 *
 * **Quick start (CLI):**
 * ```bash
 * npx @contextcompany/openclaw --port 4318
 * ```
 *
 * **Programmatic usage:**
 * ```ts
 * import { createCollector } from "@contextcompany/openclaw";
 *
 * const collector = createCollector({ port: 4318 });
 * await collector.start();
 * ```
 *
 * @packageDocumentation
 */

export { OpenClawCollector, createCollector } from "./collector";
export type { OpenClawCollectorConfig } from "./types";
export { submitFeedback } from "@contextcompany/api";

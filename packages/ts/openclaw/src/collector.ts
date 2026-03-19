import { createOtlpServer } from "./server";
import { TraceAssembler } from "./mapper";
import { createSender } from "./sender";
import { setDebug, debug } from "./logger";
import type { OpenClawCollectorConfig } from "./types";

const DEFAULT_PORT = 4318;
const DEFAULT_HOST = "0.0.0.0";

/**
 * An OTLP collector that receives traces from OpenClaw, maps them to TCC's
 * batch format, and forwards them to The Context Company's API.
 *
 * @example
 * ```ts
 * import { OpenClawCollector } from "@contextcompany/openclaw";
 *
 * const collector = new OpenClawCollector({ port: 4318, debug: true });
 * await collector.start();
 *
 * // ... OpenClaw sends traces to http://localhost:4318 ...
 *
 * await collector.stop();
 * ```
 */
export class OpenClawCollector {
  private readonly config: Required<
    Pick<OpenClawCollectorConfig, "port" | "host" | "debug">
  > &
    OpenClawCollectorConfig;

  private server: ReturnType<typeof createOtlpServer> | null = null;
  private assembler: TraceAssembler | null = null;

  constructor(config: OpenClawCollectorConfig = {}) {
    this.config = {
      ...config,
      port: config.port ?? DEFAULT_PORT,
      host: config.host ?? DEFAULT_HOST,
      debug: config.debug ?? false,
    };

    if (this.config.debug) setDebug(true);
  }

  /**
   * Start the OTLP receiver. The server will listen on the configured
   * host and port and begin accepting traces from OpenClaw.
   */
  async start(): Promise<void> {
    const send = createSender({
      apiKey: this.config.apiKey,
      endpoint: this.config.endpoint,
    });

    this.assembler = new TraceAssembler({
      flushTimeoutMs: this.config.flushTimeoutMs,
      onBatch: (batch) => {
        send(batch).catch((err) =>
          console.error("[TCC OpenClaw] Error sending batch:", err)
        );
      },
    });

    this.server = createOtlpServer(
      this.config.host,
      this.config.port,
      (spans) => {
        this.assembler!.ingest(spans);
      }
    );

    await this.server.start();

    console.log(
      `[TCC OpenClaw] Collector listening on http://${this.config.host}:${this.config.port}`
    );
    console.log(
      `[TCC OpenClaw] Configure OpenClaw to send traces to http://localhost:${this.config.port}`
    );
  }

  /**
   * Gracefully stop the collector. Flushes any pending traces and closes
   * the HTTP server.
   */
  async stop(): Promise<void> {
    debug("Shutting down collector...");

    // Flush all pending traces
    if (this.assembler) {
      this.assembler.flushAll();
    }

    // Stop the HTTP server
    if (this.server) {
      await this.server.stop();
    }

    debug("Collector stopped");
  }
}

/**
 * Convenience factory to create and immediately return a collector instance.
 *
 * @example
 * ```ts
 * import { createCollector } from "@contextcompany/openclaw";
 *
 * const collector = createCollector({ port: 4318 });
 * await collector.start();
 * ```
 */
export function createCollector(
  config?: OpenClawCollectorConfig
): OpenClawCollector {
  return new OpenClawCollector(config);
}

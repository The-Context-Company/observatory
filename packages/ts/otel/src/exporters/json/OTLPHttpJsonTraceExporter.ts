// We minimally re-implement @vercel/otel OTLPHttpJsonTraceExporter so
// non-Next.js projects don't need to install @vercel/otel as a dependency
import type { OTLPExporterError } from "@opentelemetry/otlp-exporter-base";
import type { ExportResult } from "@opentelemetry/core";
import { type ReadableSpan, SpanExporter } from "@opentelemetry/sdk-trace-base";
import { JsonTraceSerializer } from "@opentelemetry/otlp-transformer/build/src/trace/json/trace";
import { diag } from "@opentelemetry/api";
import { debug } from "../../internal/logger";
import { waitUntil } from "../../internal/waitUntil";

type OTLPExporterConfig = {
  url: string;
  headers?: Record<string, unknown>;
};

export class OTLPHttpJsonTraceExporter implements SpanExporter {
  private readonly _url: string;
  private readonly _headers?: Record<string, unknown>;

  // keep track of traces that are currently being sent so we can
  // wait for them to complete in case shutdown() is called
  private _sendingPromises: Promise<void>[] = [];
  private _shutdownOnce = { isCalled: false };

  constructor(config: OTLPExporterConfig) {
    this._url = config.url;
    this._headers = config.headers;
  }

  export(
    spans: ReadableSpan[],
    resultCallback: (result: ExportResult) => void
  ): void {
    if (this._shutdownOnce.isCalled) {
      diag.debug("@contextcompany/otel: ignoring export called after shutdown");
      return;
    }

    this.send(
      spans,
      () => resultCallback({ code: 0 }),
      (error) => resultCallback({ code: 1, error })
    );
  }

  async shutdown(): Promise<void> {
    this._shutdownOnce.isCalled = true;
    diag.debug("@contextcompany/otel: shutdown OTLPHttpJsonTraceExporter");
    // make sure we send any remaining traces before shutting down
    await this.forceFlush();
  }

  async forceFlush(): Promise<void> {
    await Promise.all(this._sendingPromises);
  }

  send(
    spans: ReadableSpan[],
    onSuccess: () => void,
    onError: (err: OTLPExporterError) => void
  ): void {
    const serialized = JsonTraceSerializer.serializeRequest(spans);
    const body = new TextDecoder().decode(serialized);
    const contentType = "application/json";

    debug(`Exporting ${spans.length} spans`);

    const promise = fetch(this._url, {
      method: "POST",
      body,
      headers: {
        ...this._headers,
        "Content-Type": contentType,
        // OTLP states exporters "SHOULD emit a User-Agent header to at a minimum
        // identify the exporter, the language of its implementation, and the version of the exporter.
        // @vercel/otel assumes exporter version "0.46.0", so we keep the same version
        "User-Agent": "OTel-OTLP-Exporter-JavaScript/0.46.0",
      },
    })
      .then((res) => {
        // drain the body so the connection can be reused
        void res.arrayBuffer().catch(() => undefined);
        if (!res.ok) {
          const message = `Failed to export ${spans.length} spans: HTTP ${res.status}`;
          debug(message);
          diag.error(`@contextcompany/otel: ${message}`);
          onError(new Error(message) as OTLPExporterError);
          return;
        }
        debug(`Successfully exported ${spans.length} spans`);
        onSuccess();
      })
      .catch((err) => {
        debug(`Error exporting ${spans.length} spans: ${err}`);
        diag.error(`@contextcompany/otel: failed to export spans: ${err}`);
        onError(err as OTLPExporterError);
      })
      .finally(() => {
        // remove from _sendingPromises after the request has completed
        const index = this._sendingPromises.indexOf(promise);
        this._sendingPromises.splice(index, 1);
      });

    // add to _sendingPromises so we can wait for them to complete in case shutdown() is called
    this._sendingPromises.push(promise);

    // On serverless runtimes (Vercel), the instance can be frozen the moment
    // the HTTP response closes — which is typically right when the run span
    // ends and this export fires. Register the export with the platform's
    // waitUntil so the invocation stays alive until delivery completes.
    // No-op outside a serverless request context.
    waitUntil(promise);
  }
}

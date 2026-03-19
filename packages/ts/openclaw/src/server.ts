import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import type {
  OtlpTracesPayload,
  OtlpKeyValue,
  OtlpAttributeValue,
  OpenClawSpan,
} from "./types";
import { debug } from "./logger";

// ---------------------------------------------------------------------------
// OTLP attribute helpers
// ---------------------------------------------------------------------------

function resolveAttributeValue(
  value: OtlpAttributeValue
): string | number | boolean {
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.intValue !== undefined)
    return typeof value.intValue === "string"
      ? parseInt(value.intValue, 10)
      : value.intValue;
  if (value.doubleValue !== undefined) return value.doubleValue;
  if (value.boolValue !== undefined) return value.boolValue;
  // For arrays/kvlists, stringify for storage
  if (value.arrayValue !== undefined) return JSON.stringify(value.arrayValue);
  if (value.kvlistValue !== undefined) return JSON.stringify(value.kvlistValue);
  return "";
}

function flattenAttributes(
  attrs?: OtlpKeyValue[]
): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};
  if (!attrs) return result;
  for (const kv of attrs) {
    result[kv.key] = resolveAttributeValue(kv.value);
  }
  return result;
}

/** Convert an OTLP nanosecond timestamp string to milliseconds. */
function nanoToMs(nanoStr: string): number {
  // OTLP sends timestamps as string or number of nanoseconds since epoch
  const nanos = BigInt(nanoStr);
  return Number(nanos / 1_000_000n);
}

// ---------------------------------------------------------------------------
// Parse an OTLP JSON payload into flat OpenClawSpan objects
// ---------------------------------------------------------------------------

export function parseOtlpPayload(payload: OtlpTracesPayload): OpenClawSpan[] {
  const spans: OpenClawSpan[] = [];

  for (const resourceSpan of payload.resourceSpans ?? []) {
    const resourceAttrs = flattenAttributes(
      resourceSpan.resource?.attributes
    );

    for (const scopeSpan of resourceSpan.scopeSpans ?? []) {
      for (const raw of scopeSpan.spans ?? []) {
        spans.push({
          traceId: raw.traceId,
          spanId: raw.spanId,
          parentSpanId: raw.parentSpanId || undefined,
          name: raw.name,
          kind: raw.kind,
          startTimeMs: nanoToMs(raw.startTimeUnixNano),
          endTimeMs: nanoToMs(raw.endTimeUnixNano),
          attributes: flattenAttributes(raw.attributes),
          statusCode: raw.status?.code ?? 0,
          statusMessage: raw.status?.message,
          events: raw.events,
          resourceAttributes: resourceAttrs,
        });
      }
    }
  }

  return spans;
}

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------

export type SpanHandler = (spans: OpenClawSpan[]) => void;

export function createOtlpServer(
  host: string,
  port: number,
  onSpans: SpanHandler
): { server: Server; start: () => Promise<void>; stop: () => Promise<void> } {
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    // Health check
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    // OTLP traces endpoint
    if (req.method === "POST" && req.url === "/v1/traces") {
      handleTraces(req, res, onSpans);
      return;
    }

    // OTLP metrics/logs endpoints — acknowledge but discard
    if (
      req.method === "POST" &&
      (req.url === "/v1/metrics" || req.url === "/v1/logs")
    ) {
      consumeBody(req).then(() => {
        debug(`Received ${req.url} (discarded — only traces are processed)`);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end("{}");
      });
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });

  return {
    server,
    start: () =>
      new Promise<void>((resolve, reject) => {
        server.on("error", reject);
        server.listen(port, host, () => {
          debug(`OTLP receiver listening on http://${host}:${port}`);
          resolve();
        });
      }),
    stop: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

// ---------------------------------------------------------------------------
// Request handling helpers
// ---------------------------------------------------------------------------

function consumeBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function handleTraces(
  req: IncomingMessage,
  res: ServerResponse,
  onSpans: SpanHandler
): Promise<void> {
  try {
    const body = await consumeBody(req);
    const contentType = req.headers["content-type"] ?? "";

    // We only support JSON. If protobuf is sent, return a helpful error.
    if (
      contentType.includes("protobuf") ||
      contentType.includes("proto")
    ) {
      res.writeHead(415, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error:
            'Protobuf is not supported. Configure OpenClaw with "protocol": "http/json" in diagnostics.otel settings.',
        })
      );
      return;
    }

    const payload: OtlpTracesPayload = JSON.parse(body.toString("utf-8"));

    if (!payload.resourceSpans || !Array.isArray(payload.resourceSpans)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ error: "Invalid OTLP payload: missing resourceSpans" })
      );
      return;
    }

    const spans = parseOtlpPayload(payload);
    debug(`Received ${spans.length} span(s) from OTLP`);

    onSpans(spans);

    // OTLP expects an empty JSON object on success
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end("{}");
  } catch (err) {
    debug("Error processing OTLP request:", err);
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Invalid request",
      })
    );
  }
}

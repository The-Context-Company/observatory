import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type AnyExportedSpan,
  TracingEventType,
} from "@mastra/core/observability";
import { TCCMastraExporter } from "./exporter";

const ENDPOINT = "http://localhost:8787/v1/mastra";
const RUN_ID = "11111111-1111-4111-8111-111111111111";

type FetchCall = { url: string; body: any };

let calls: FetchCall[];
let resolveFetches: Array<() => void>;

/** Install a fetch mock whose responses only resolve when `releaseFetches()` is called. */
function installPendingFetch() {
  calls = [];
  resolveFetches = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(init.body as string) });
      await new Promise<void>((resolve) => resolveFetches.push(resolve));
      return { ok: true } as Response;
    })
  );
}

function releaseFetches() {
  for (const resolve of resolveFetches.splice(0)) resolve();
}

function span(
  overrides: Partial<AnyExportedSpan> & Pick<AnyExportedSpan, "id" | "traceId">
): AnyExportedSpan {
  return {
    name: "span",
    type: "agent_run",
    isRootSpan: false,
    isEvent: false,
    startTime: new Date("2026-09-05T00:00:00Z"),
    ...overrides,
  } as AnyExportedSpan;
}

const started = (s: AnyExportedSpan) =>
  ({ type: TracingEventType.SPAN_STARTED, exportedSpan: s }) as const;
const ended = (s: AnyExportedSpan) =>
  ({ type: TracingEventType.SPAN_ENDED, exportedSpan: s }) as const;

const tick = () => new Promise((r) => setImmediate(r));

describe("TCCMastraExporter", () => {
  beforeEach(installPendingFetch);
  afterEach(() => vi.unstubAllGlobals());

  it("exports one payload per trace when the root span ends, using tcc.runId", async () => {
    const exporter = new TCCMastraExporter({ apiKey: "tcc_test", endpoint: ENDPOINT });
    const root = span({
      id: "root",
      traceId: "t1",
      isRootSpan: true,
      metadata: { "tcc.runId": RUN_ID, "tcc.sessionId": "s1", custom: "x" },
    });
    const child = span({ id: "child", traceId: "t1", type: "model_step" as any, parentSpanId: "root" });

    await exporter.exportTracingEvent(started(root));
    await exporter.exportTracingEvent(started(child));
    await exporter.exportTracingEvent(ended({ ...child, endTime: new Date() }));
    const rootEnd = exporter.exportTracingEvent(ended({ ...root, endTime: new Date() }));
    releaseFetches();
    await rootEnd;

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(ENDPOINT);
    expect(calls[0]!.body.runId).toBe(RUN_ID);
    expect(calls[0]!.body.traceId).toBe("t1");
    expect(calls[0]!.body.framework).toBe("mastra");
    expect(calls[0]!.body.metadata).toEqual({ "tcc.runId": RUN_ID, "tcc.sessionId": "s1", custom: "x" });
    expect(calls[0]!.body.spans.map((s: any) => s.id)).toEqual(["root", "child"]);
    expect(calls[0]!.body.spans.every((s: any) => s.runId === RUN_ID)).toBe(true);
  });

  it("does not re-export a trace when flush() runs while its request is in flight", async () => {
    const exporter = new TCCMastraExporter({ apiKey: "tcc_test", endpoint: ENDPOINT });
    const root = span({ id: "root", traceId: "t1", isRootSpan: true, metadata: { "tcc.runId": RUN_ID } });

    await exporter.exportTracingEvent(started(root));
    // Root end kicks off a POST that has not resolved yet (fetch mock is pending).
    const rootEnd = exporter.exportTracingEvent(ended({ ...root, endTime: new Date() }));
    await tick();
    expect(calls).toHaveLength(1);

    const flush = exporter.flush();
    await tick();
    // flush() must wait for the in-flight request rather than resolve early.
    let flushed = false;
    void flush.then(() => (flushed = true));
    await tick();
    expect(flushed).toBe(false);

    releaseFetches();
    await Promise.all([rootEnd, flush]);
    expect(flushed).toBe(true);
    expect(calls).toHaveLength(1);
  });

  it("flush() exports traces whose root span has not ended, exactly once, and shutdown() adds nothing", async () => {
    const exporter = new TCCMastraExporter({ apiKey: "tcc_test", endpoint: ENDPOINT });
    await exporter.exportTracingEvent(
      started(span({ id: "a", traceId: "t1", isRootSpan: true, metadata: { "tcc.runId": RUN_ID } }))
    );
    await exporter.exportTracingEvent(started(span({ id: "b", traceId: "t2", isRootSpan: true })));

    const flush = exporter.flush();
    await tick();
    releaseFetches();
    await flush;
    expect(calls.map((c) => c.body.traceId).sort()).toEqual(["t1", "t2"]);

    const shutdown = exporter.shutdown();
    releaseFetches();
    await shutdown;
    expect(calls).toHaveLength(2);
  });

  it("generates a run id when tcc.runId is not provided", async () => {
    const exporter = new TCCMastraExporter({ apiKey: "tcc_test", endpoint: ENDPOINT });
    const root = span({ id: "root", traceId: "t1", isRootSpan: true });
    await exporter.exportTracingEvent(started(root));
    const rootEnd = exporter.exportTracingEvent(ended({ ...root, endTime: new Date() }));
    releaseFetches();
    await rootEnd;
    expect(calls[0]!.body.runId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("throws when no API key is available", () => {
    const prev = process.env.TCC_API_KEY;
    delete process.env.TCC_API_KEY;
    try {
      expect(() => new TCCMastraExporter({})).toThrow(/Missing API key/);
    } finally {
      if (prev !== undefined) process.env.TCC_API_KEY = prev;
    }
  });
});

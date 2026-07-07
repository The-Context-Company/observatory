// Serverless platforms (Vercel in particular) freeze or terminate the
// function instance as soon as the HTTP response finishes. Span exports
// are triggered by span end, which typically happens at the same moment
// the response closes — so a fire-and-forget export fetch can be killed
// mid-flight and the run silently never reaches ingest.
//
// Vercel exposes a request context on a well-known global symbol whose
// `waitUntil` keeps the instance alive until the given promise settles.
// This is the same mechanism `@vercel/functions` uses under the hood. We
// read it directly so the package works without any extra dependency and
// without users changing their code. On non-Vercel runtimes the symbol is
// absent and this is a no-op.

const VERCEL_REQUEST_CONTEXT_SYMBOL = Symbol.for("@vercel/request-context");

type VercelRequestContext = {
  waitUntil?: (promise: Promise<unknown>) => void;
};

type VercelRequestContextReader = {
  get?: () => VercelRequestContext | undefined;
};

/**
 * Best-effort: keep the current serverless invocation alive until the
 * promise settles. No-op outside a request context or off Vercel.
 */
export function waitUntil(promise: Promise<unknown>): void {
  try {
    const reader = (globalThis as Record<symbol, unknown>)[
      VERCEL_REQUEST_CONTEXT_SYMBOL
    ] as VercelRequestContextReader | undefined;
    reader?.get?.()?.waitUntil?.(promise);
  } catch {
    // Never let lifetime management break exporting itself.
  }
}

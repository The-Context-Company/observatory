import { NextResponse } from "next/server";
import type { UIMessage } from "ai";

/**
 * Best-effort guards for the example API routes: a lightweight rate limiter and
 * request-body validation. Together with `authorizeExampleRequest` these bound
 * how much the demo's server-side OpenAI key can be abused by unauthenticated
 * or scripted traffic (the concern raised in the pentest finding).
 *
 * These are intentionally simple and NOT production-grade:
 *   - Rate-limit state lives in process memory, so it resets on redeploy and is
 *     not shared across serverless instances or regions.
 *   - The client identifier comes from forwarded headers, which can be spoofed
 *     behind an untrusted proxy.
 *
 * For real deployments, put auth in front of the endpoint and enforce limits in
 * a durable, shared store (e.g. Upstash/Redis) keyed by an authenticated user.
 */

// Reject oversized bodies before we hand them to the model — a single huge
// prompt can be expensive, so cap it well above a normal demo conversation.
const MAX_BODY_BYTES = 128 * 1024; // 128 KB
const MAX_MESSAGES = 100;
const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

const RATE_LIMIT_MAX = parseCount(process.env.TCC_EXAMPLE_RATE_LIMIT_MAX, 20);
const RATE_LIMIT_WINDOW_MS = parseCount(
  process.env.TCC_EXAMPLE_RATE_LIMIT_WINDOW_MS,
  60_000
);

type RateBucket = { count: number; resetAt: number };
const rateBuckets = new Map<string, RateBucket>();

export type ChatRequest = {
  messages: UIMessage[];
  sessionId?: string;
};

export type ChatRequestResult =
  | { ok: true; data: ChatRequest }
  | { ok: false; response: NextResponse };

/**
 * Fixed-window rate limit per client. Returns a 429 response when the limit is
 * exceeded, or `null` to let the request proceed. Set either env knob to 0 to
 * disable.
 */
export function enforceExampleRateLimit(
  request: Request,
  scope = "example"
): NextResponse | null {
  if (RATE_LIMIT_MAX <= 0 || RATE_LIMIT_WINDOW_MS <= 0) return null;

  const now = Date.now();
  pruneExpiredBuckets(now);

  const key = `${scope}:${clientIdentifier(request)}`;
  const bucket = rateBuckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return null;
  }

  if (bucket.count >= RATE_LIMIT_MAX) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((bucket.resetAt - now) / 1000)
    );
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  bucket.count += 1;
  return null;
}

/**
 * Reads and validates the chat request body: caps its size, ensures `messages`
 * is a non-empty, reasonably sized array, and sanitizes the client-supplied
 * `sessionId` so untrusted input never reaches telemetry unchecked.
 */
export async function readChatRequest(
  request: Request
): Promise<ChatRequestResult> {
  const raw = await request.text();

  if (byteLength(raw) > MAX_BODY_BYTES) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Request body too large" },
        { status: 413 }
      ),
    };
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return badRequest("Invalid JSON body");
  }

  if (typeof body !== "object" || body === null) {
    return badRequest("Request body must be a JSON object");
  }

  const { messages, sessionId } = body as {
    messages?: unknown;
    sessionId?: unknown;
  };

  if (!Array.isArray(messages) || messages.length === 0) {
    return badRequest("`messages` must be a non-empty array");
  }

  if (messages.length > MAX_MESSAGES) {
    return badRequest(`Too many messages (max ${MAX_MESSAGES})`);
  }

  return {
    ok: true,
    data: {
      messages: messages as UIMessage[],
      sessionId: sanitizeSessionId(sessionId),
    },
  };
}

/**
 * Returns the value only when it is a safe, bounded session identifier;
 * otherwise `undefined` so the caller can fall back to a server-generated id.
 */
export function sanitizeSessionId(value: unknown): string | undefined {
  return typeof value === "string" && SESSION_ID_PATTERN.test(value)
    ? value
    : undefined;
}

function badRequest(message: string): ChatRequestResult {
  return {
    ok: false,
    response: NextResponse.json({ error: message }, { status: 400 }),
  };
}

function clientIdentifier(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const firstForwarded = forwardedFor?.split(",")[0]?.trim();
  if (firstForwarded) return firstForwarded;

  return request.headers.get("x-real-ip")?.trim() || "local";
}

function pruneExpiredBuckets(now: number): void {
  for (const [key, bucket] of rateBuckets) {
    if (now >= bucket.resetAt) rateBuckets.delete(key);
  }
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

function parseCount(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

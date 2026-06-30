const PROD_BASE = "https://api.thecontext.company";
const DEV_BASE = "https://dev.thecontext.company";
const ALLOWED_REMOTE_ORIGINS = new Set([PROD_BASE, DEV_BASE]);

function isUnsafeBaseUrlAllowed(): boolean {
  return (
    typeof process !== "undefined" &&
    process.env?.TCC_ALLOW_UNSAFE_BASE_URL === "1"
  );
}

function isLocalhostOrigin(origin: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin);
}

/**
 * Whether `origin` is a TCC-controlled origin the SDK may send the API key and
 * telemetry to without an explicit opt-in.
 */
function isAllowedTCCOrigin(origin: string): boolean {
  return ALLOWED_REMOTE_ORIGINS.has(origin) || isLocalhostOrigin(origin);
}

export function normalizeTCCBaseUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`[TCC] Invalid TCC base URL: ${url}`);
  }

  const base = parsed.origin + parsed.pathname.replace(/\/+$/, "");
  if (isAllowedTCCOrigin(parsed.origin) || isUnsafeBaseUrlAllowed()) {
    return base;
  }

  throw new Error(
    `[TCC] Refusing unsafe TCC base URL (${base}). Use ${PROD_BASE}, ${DEV_BASE}, localhost, or set TCC_ALLOW_UNSAFE_BASE_URL=1 for self-hosted testing.`
  );
}

/**
 * Defense-in-depth guard for the network sinks that attach the API key
 * (`Authorization: Bearer …`) and ship telemetry. Throws unless `url` targets
 * an allowed TCC origin (prod/dev/localhost) or the operator explicitly opted
 * into self-hosting via `TCC_ALLOW_UNSAFE_BASE_URL=1`.
 *
 * This complements {@link normalizeTCCBaseUrl}: even if an endpoint reaches a
 * sink without passing through base-URL normalization (e.g. an explicit
 * endpoint override, or a hijacked `TCC_BASE_URL` / `TCC_FEEDBACK_URL`), the
 * API key and trace data are never sent to an untrusted host.
 */
export function assertSafeTCCUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`[TCC] Invalid TCC URL: ${url}`);
  }

  if (isAllowedTCCOrigin(parsed.origin) || isUnsafeBaseUrlAllowed()) {
    return;
  }

  throw new Error(
    `[TCC] Refusing to send credentials to unsafe URL (${parsed.origin}). Use ${PROD_BASE}, ${DEV_BASE}, localhost, or set TCC_ALLOW_UNSAFE_BASE_URL=1 for self-hosted testing.`
  );
}

/**
 * Get TCC API key from environment
 */
export function getTCCApiKey(): string | undefined {
  if (typeof process !== "undefined" && process.env) {
    return process.env.TCC_API_KEY;
  }
  return undefined;
}

/**
 * Get the TCC base URL (no trailing slash).
 * Reads from `TCC_BASE_URL` env var, otherwise auto-detects from API key prefix.
 */
export function getTCCBaseUrl(apiKey?: string): string {
  if (typeof process !== "undefined" && process.env?.TCC_BASE_URL) {
    return normalizeTCCBaseUrl(process.env.TCC_BASE_URL);
  }
  const envApiKey =
    typeof process !== "undefined" && process.env
      ? process.env.TCC_API_KEY
      : undefined;
  const key = apiKey ?? envApiKey ?? "";
  return key.startsWith("dev_") ? DEV_BASE : PROD_BASE;
}

/**
 * Get a full TCC endpoint URL by appending a path to the base URL.
 * @param path - The path to append (e.g. "/v1/pi")
 * @param apiKey - API key to check for dev_ prefix
 */
export function getTCCUrl(path: string, apiKey?: string): string {
  return `${getTCCBaseUrl(apiKey)}${path}`;
}

/**
 * Get TCC Feedback URL with default (same across all packages)
 */
export function getTCCFeedbackUrl(): string {
  const envUrl =
    typeof process !== "undefined" && process.env
      ? process.env.TCC_FEEDBACK_URL
      : undefined;
  if (envUrl) {
    const url = new URL(envUrl);
    const base = normalizeTCCBaseUrl(
      url.origin + url.pathname.replace(/\/v1\/feedback\/?$/, "")
    );
    return `${base}/v1/feedback`;
  }
  return `${getTCCBaseUrl()}/v1/feedback`;
}

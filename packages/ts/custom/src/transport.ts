import { getConfig } from "./config";

function resolveApiKey(): string | undefined {
  const { apiKey } = getConfig();
  if (apiKey) return apiKey;
  if (typeof process !== "undefined" && process.env?.TCC_API_KEY) {
    return process.env.TCC_API_KEY;
  }
  return undefined;
}

function resolveUrl(apiKey: string): string {
  const { url } = getConfig();
  if (url) return url;
  if (typeof process !== "undefined" && process.env?.TCC_URL) {
    return process.env.TCC_URL;
  }
  const isDev = apiKey.startsWith("dev_");
  return isDev
    ? "https://dev.thecontext.company/v1/custom"
    : "https://api.thecontext.company/v1/custom";
}

export function isDebug(): boolean {
  const { debug: flag } = getConfig();
  if (flag) return true;
  if (typeof process !== "undefined" && process.env) {
    const env = process.env.TCC_DEBUG;
    return env === "true" || env === "1";
  }
  return false;
}

export function debug(...args: unknown[]): void {
  if (!isDebug()) return;
  console.log(
    "[TCC]",
    ...args.map((a) =>
      typeof a === "object" && a !== null
        ? JSON.stringify(a, null, 2)
        : String(a)
    )
  );
}

const MAX_RETRIES = 2;
const INITIAL_BACKOFF_MS = 1000;

function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function send(payload: Record<string, unknown>): Promise<void> {
  const apiKey = resolveApiKey();
  if (!apiKey) {
    console.warn(
      "[TCC] No API key found. Set TCC_API_KEY or call configure({ apiKey })."
    );
    return;
  }

  const url = resolveUrl(apiKey);
  const body = JSON.stringify(payload);
  debug("Sending payload to", url);
  debug("Payload:", payload);

  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
      debug(`Retry ${attempt}/${MAX_RETRIES} after ${backoff}ms`);
      await sleep(backoff);
    }

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body,
      });

      if (res.ok) {
        debug("Payload sent successfully");
        return;
      }

      const text = await res.text();

      if (!isRetryable(res.status)) {
        console.error(`[TCC] Ingestion failed (${res.status}): ${text}`);
        return;
      }

      lastError = `${res.status}: ${text}`;
      debug(`Retryable error: ${lastError}`);
    } catch (err) {
      lastError = err;
      debug("Network error, will retry:", err);
    }
  }

  console.error(
    `[TCC] Ingestion failed after ${MAX_RETRIES + 1} attempts:`,
    lastError
  );
}

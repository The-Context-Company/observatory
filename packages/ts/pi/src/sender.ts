import { getTCCApiKey, getTCCUrl } from "@contextcompany/api";
import { debug } from "./logger";

const MAX_RETRIES = 2;
const INITIAL_BACKOFF_MS = 1000;

export type SenderConfig = {
  apiKey?: string;
  endpoint?: string;
};

function resolveApiKey(config: SenderConfig): string | undefined {
  if (config.apiKey) return config.apiKey;
  return getTCCApiKey();
}

function resolveUrl(config: SenderConfig, apiKey: string): string {
  if (config.endpoint) return config.endpoint;
  return getTCCUrl("/v1/pi", apiKey);
}

function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Creates a sender function bound to the given configuration.
 * The returned function sends a payload to TCC's Pi ingestion
 * endpoint with retry logic for transient failures.
 */
export function createSender(
  config: SenderConfig
): (payload: unknown) => Promise<void> {
  const apiKey = resolveApiKey(config);

  if (!apiKey) {
    console.warn(
      "[TCC Pi] No API key found. Set TCC_API_KEY or pass apiKey in config. Telemetry will not be sent."
    );
    return async () => {};
  }

  const url = resolveUrl(config, apiKey);
  debug(`TCC endpoint: ${url}`);

  return async (payload: unknown): Promise<void> => {
    const body = JSON.stringify(payload);
    debug(`Sending Pi payload`);

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
          debug("Successfully sent trace data to TCC");
          return;
        }

        const text = await res.text();

        if (!isRetryable(res.status)) {
          console.error(
            `[TCC Pi] Ingestion failed (${res.status}): ${text}`
          );
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
      `[TCC Pi] Ingestion failed after ${MAX_RETRIES + 1} attempts:`,
      lastError
    );
  };
}

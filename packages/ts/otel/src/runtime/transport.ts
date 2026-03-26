import type { BatchPayload, TCCAISDKTelemetryConfig } from "./types.js";
import { debugLog } from "./utils.js";

const MAX_RETRIES = 2;
const INITIAL_BACKOFF_MS = 1000;
const DEFAULT_PROD_URL = "https://ingest.thecontext.company/v1/custom";
const DEFAULT_DEV_URL = "https://dev.thecontext.company/v1/custom";

export class RuntimeBatchTransport {
  private readonly apiKey: string;
  private readonly url: string;
  private readonly debugEnabled: boolean;
  private readonly pendingRequests = new Set<Promise<void>>();

  constructor(
    config: Pick<TCCAISDKTelemetryConfig, "apiKey" | "url" | "debug">
  ) {
    this.apiKey = config.apiKey;
    this.url = config.url ?? getDefaultUrl(config.apiKey);
    this.debugEnabled = config.debug === true;
  }

  send(payload: BatchPayload): Promise<void> {
    let requestPromise: Promise<void>;

    requestPromise = this.sendWithRetry(payload).finally(() => {
      this.pendingRequests.delete(requestPromise);
    });

    this.pendingRequests.add(requestPromise);
    return requestPromise;
  }

  async flush(): Promise<void> {
    await Promise.all([...this.pendingRequests]);
  }

  private async sendWithRetry(payload: BatchPayload): Promise<void> {
    const body = JSON.stringify(payload);
    let lastError: unknown;

    debugLog(this.debugEnabled, "Sending AI SDK batch payload", {
      url: this.url,
      items: payload.items.length,
    });

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      if (attempt > 0) {
        const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
        debugLog(
          this.debugEnabled,
          `Retry ${attempt}/${MAX_RETRIES} after ${backoff}ms`
        );
        await sleep(backoff);
      }

      try {
        const response = await fetch(this.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body,
        });

        if (response.ok) {
          debugLog(this.debugEnabled, "Successfully sent AI SDK batch payload");
          return;
        }

        const text = await response.text();
        if (!isRetryable(response.status)) {
          console.error(
            `[TCC AI SDK Runtime] Ingestion failed (${response.status}): ${text}`
          );
          return;
        }

        lastError = `${response.status}: ${text}`;
        debugLog(this.debugEnabled, "Retryable ingestion error", lastError);
      } catch (error) {
        lastError = error;
        debugLog(
          this.debugEnabled,
          "Network error while sending payload",
          error
        );
      }
    }

    console.error(
      `[TCC AI SDK Runtime] Ingestion failed after ${MAX_RETRIES + 1} attempts:`,
      lastError
    );
  }
}

function getDefaultUrl(apiKey: string): string {
  return apiKey.startsWith("dev_") ? DEFAULT_DEV_URL : DEFAULT_PROD_URL;
}

function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

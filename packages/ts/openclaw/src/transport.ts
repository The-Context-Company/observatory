const MAX_RETRIES = 2;
const INITIAL_BACKOFF_MS = 1000;

export async function sendToTcc(
  payload: Record<string, unknown>,
  apiKey: string,
  url: string,
  debug: boolean,
  log: { info: (m: string) => void; warn: (m: string) => void },
): Promise<void> {
  const body = JSON.stringify(payload);
  if (debug) log.info(`sending ${body.length} bytes to ${url}`);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0)
      await new Promise((r) => setTimeout(r, INITIAL_BACKOFF_MS * 2 ** (attempt - 1)));
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
        if (debug) log.info("sent ok");
        return;
      }
      const text = await res.text();
      if (res.status !== 429 && res.status < 500) {
        log.warn(`ingestion failed (${res.status}): ${text}`);
        return;
      }
    } catch (err) {
      if (attempt === MAX_RETRIES)
        log.warn(`ingestion failed after ${MAX_RETRIES + 1} attempts: ${err}`);
    }
  }
  log.warn(`ingestion failed after ${MAX_RETRIES + 1} attempts (server errors)`);
}

export function safeClone(obj: unknown): unknown {
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    return String(obj);
  }
}

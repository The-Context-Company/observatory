const _SENTINEL: unique symbol = Symbol("TCC_SENTINEL");
type Sentinel = typeof _SENTINEL;

export { _SENTINEL };
export type { Sentinel };

let _debugEnabled = false;

export function setDebug(enabled: boolean): void {
  _debugEnabled = enabled;
}

export function _debug(...args: unknown[]): void {
  const fromEnv =
    process.env.TCC_DEBUG?.toLowerCase() === "true" ||
    process.env.TCC_DEBUG === "1";
  if (!_debugEnabled && !fromEnv) return;

  const parts = args.map((arg) =>
    typeof arg === "object" && arg !== null
      ? JSON.stringify(arg, null, 2)
      : String(arg)
  );
  console.log("[TCC Debug]", ...parts);
}

export function _nowIso(): string {
  const dt = new Date();
  return dt.toISOString().replace(/(\.\d{3})\d*Z$/, "$1Z");
}

export async function _sendPayload(
  payload: Record<string, unknown>,
  label: string
): Promise<void> {
  const { getTCCApiKey, getTCCUrl } = await import("@contextcompany/api");

  _debug(`Sending ${label}...`);
  _debug("Payload:", payload);

  try {
    const apiKey = getTCCApiKey();

    if (!apiKey) {
      console.warn("[TCC] Missing TCC_API_KEY, skipping telemetry");
      return;
    }

    const endpoint = getTCCUrl(
      apiKey,
      "https://api.thecontext.company/v1/custom",
      "https://dev.thecontext.company/v1/custom"
    );

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[TCC] Failed to send ${label}: ${response.status} ${text}`);
    } else {
      _debug(`Successfully sent ${label}`);
    }
  } catch (error) {
    console.error(`[TCC] Failed to send ${label}:`, error);
  }
}

export type SDKMessage = { type: string; [key: string]: any };

export type TCCConfig = {
  runId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
  debug?: boolean;
};

type ResolvedTCCConfig = {
  runId: string;
  sessionId: string | null;
  metadata: Record<string, unknown>;
};

let DEBUG_ENABLED = false;

function formatDebugValue(value: unknown): string {
  if (typeof value === "string") return value;

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function debugLog(...args: unknown[]): void {
  if (!DEBUG_ENABLED) return;
  console.log("[TCC Debug]", ...args.map(formatDebugValue));
}

export function resolveTCCConfig(tccConfig?: TCCConfig): ResolvedTCCConfig {
  if (tccConfig?.debug) DEBUG_ENABLED = true;

  const metadata = tccConfig?.metadata || {};
  const runId =
    tccConfig?.runId ??
    (metadata["tcc.runId"] as string | undefined) ??
    crypto.randomUUID();
  const sessionId =
    tccConfig?.sessionId ??
    (metadata["tcc.sessionId"] as string | undefined) ??
    null;

  return { runId, sessionId, metadata };
}

export function enrichClaudeMessage(
  message: SDKMessage,
  context: { runId: string; sessionId: string | null }
): SDKMessage {
  const existingMetadata =
    typeof message.tccMetadata === "object" && message.tccMetadata !== null
      ? (message.tccMetadata as Record<string, unknown>)
      : {};

  return {
    ...message,
    receivedAtMs:
      typeof message.receivedAtMs === "number" ? message.receivedAtMs : Date.now(),
    tccMetadata: {
      ...existingMetadata,
      runId: context.runId,
      sessionId: context.sessionId,
    },
  };
}

export async function sendToClaudeIngestion(payload: {
  messages: SDKMessage[];
  customMetadata?: Record<string, unknown>;
  runId?: string;
  sessionId?: string | null;
  userPrompt?: string | null;
}): Promise<void> {
  const { getTCCApiKey, getTCCUrl } = await import("@contextcompany/api");

  const apiKey = getTCCApiKey();

  if (!apiKey) {
    console.warn("[TCC] Missing TCC_API_KEY, skipping telemetry");
    return;
  }

  const endpoint = getTCCUrl(
    apiKey,
    "https://api.thecontext.company/v1/claude",
    "https://dev.thecontext.company/v1/claude"
  );

  debugLog("Sending Claude telemetry payload", payload);

  try {
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
      throw new Error(`HTTP ${response.status}: ${text}`);
    }

    debugLog(`Successfully sent ${payload.messages.length} Claude messages`);
  } catch (error) {
    console.error("[TCC] Error sending telemetry:", error);
  }
}

import { randomUUID } from "node:crypto";

type SDKMessage = { type: string; [key: string]: any };
type QueryFn = (...args: any[]) => AsyncGenerator<SDKMessage, void, unknown>;

export type TCCConfig = {
  runId?: string;
  sessionId?: string;
  /** Mark this run as user-initiated for user insights. */
  conversational?: boolean;
  metadata?: Record<string, unknown>;
  debug?: boolean;
};

export type WrappedSDK<T> = T extends { query: infer Q extends QueryFn }
  ? Omit<T, "query"> & {
      query: (params: Parameters<Q>[0] & { tcc?: TCCConfig }) => ReturnType<Q>;
    }
  : T;

const pendingTelemetry = new Set<Promise<void>>();

/** Wait for telemetry started by closed queries before shutting down. */
export async function flushClaudeTelemetry(): Promise<void> {
  await Promise.all([...pendingTelemetry]);
}

function instrumentQuery(queryFn: QueryFn, target: unknown): QueryFn {
  return function (params: any) {
    const { tcc: config = {}, ...sdkParams } = params;
    const runId =
      config.runId ?? config.metadata?.["tcc.runId"] ?? randomUUID();
    const sessionId =
      config.sessionId ?? config.metadata?.["tcc.sessionId"] ?? null;
    const metadata = { ...config.metadata };
    if (config.conversational !== undefined) {
      metadata["tcc.conversational"] = config.conversational;
    }
    const messages: SDKMessage[] = [];
    const inputTexts: string[] = [];
    if (
      typeof sdkParams.prompt !== "string" &&
      sdkParams.prompt?.[Symbol.asyncIterator]
    ) {
      const input = sdkParams.prompt;
      sdkParams.prompt = (async function* () {
        for await (const message of input) {
          const content = message.message?.content;
          if (typeof content === "string") inputTexts.push(content);
          else if (Array.isArray(content)) {
            for (const block of content)
              if (block.type === "text") inputTexts.push(block.text);
          }
          yield message;
        }
      })();
    }
    // Create immediately: SDK controls must work before iteration starts.
    const original = Reflect.apply(queryFn, target, [sdkParams]);
    let sending: Promise<void> | undefined;
    const send = () => {
      if (!sending && messages.length) {
        sending = sendToAuthTagger(
          {
            messages,
            customMetadata: metadata,
            runId,
            sessionId,
            userPrompt:
              typeof params.prompt === "string"
                ? params.prompt
                : inputTexts.join("\n") || null,
          },
          config.debug === true
        ).catch((error) => {
          console.error("[TCC] Failed to send telemetry:", error);
        });
        pendingTelemetry.add(sending);
        void sending.finally(() => pendingTelemetry.delete(sending!));
      }
      return sending;
    };
    let started = false;
    const iterator = (async function* () {
      try {
        for await (const message of original) {
          messages.push({
            ...message,
            receivedAtMs: Date.now(),
            tccMetadata: { runId, sessionId },
          });
          yield message;
        }
      } finally {
        // Also runs on break, return(), throw(), and SDK errors.
        await send();
      }
    })();
    const proxy: ReturnType<QueryFn> = new Proxy(original, {
      get(object, prop) {
        if (prop === Symbol.asyncIterator) return () => proxy;
        if (prop === "next")
          return (...args: [] | [unknown]) => {
            started = true;
            return iterator.next(...args);
          };
        if (prop === "return" || prop === "throw") {
          return started
            ? iterator[prop].bind(iterator)
            : original[prop].bind(original);
        }
        const value = Reflect.get(object, prop, object);
        if (prop === "close" && typeof value === "function") {
          return (...args: unknown[]) => {
            try {
              return Reflect.apply(value, object, args);
            } finally {
              const closing = iterator.return().then(
                () => {},
                (error) => {
                  console.error(
                    "[TCC] Failed to finalize closed query:",
                    error
                  );
                }
              );
              pendingTelemetry.add(closing);
              void closing.finally(() => pendingTelemetry.delete(closing));
            }
          };
        }
        return typeof value === "function" ? value.bind(object) : value;
      },
    });
    return proxy;
  } as QueryFn;
}

async function sendToAuthTagger(
  payload: {
    messages: SDKMessage[];
    customMetadata?: Record<string, unknown>;
    runId?: string;
    sessionId?: string | null;
    userPrompt?: string | null;
  },
  debug = false
): Promise<void> {
  const { getTCCApiKey, getTCCUrl } = await import("@contextcompany/api");

  const apiKey = getTCCApiKey();

  if (!apiKey) {
    console.warn("[TCC] Missing TCC_API_KEY, skipping telemetry");
    return;
  }

  const endpoint = getTCCUrl("/v1/claude", apiKey);

  if (debug) {
    console.log("[TCC Debug] Payload:", JSON.stringify(payload, null, 2));
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text}`);
    }

    if (debug) {
      console.log(
        `[TCC Debug] Successfully sent ${payload.messages.length} messages`
      );
    }
  } catch (error) {
    console.error("[TCC] Error sending telemetry:", error);
  }
}

export function instrumentClaudeAgent<T extends object>(sdk: T): WrappedSDK<T> {
  const cache = new Map<PropertyKey, unknown>();
  return new Proxy(sdk, {
    get(target, prop, receiver) {
      if (cache.has(prop)) return cache.get(prop);
      const value = Reflect.get(target, prop, receiver);
      const wrapped =
        prop === "query" && typeof value === "function"
          ? instrumentQuery(value as QueryFn, target)
          : typeof value === "function"
            ? value.bind(target)
            : value;
      cache.set(prop, wrapped);
      return wrapped;
    },
  }) as WrappedSDK<T>;
}

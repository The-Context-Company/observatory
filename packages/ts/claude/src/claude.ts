// Type definitions
type SDKMessage = { type: string; [key: string]: any };
type QueryFn = (
  ...args: unknown[]
) => AsyncGenerator<SDKMessage, void, unknown>;
type ToolDefinition = {
  name: string;
  description: string;
  handler: (args: any, extra: any) => Promise<any>;
  [key: string]: any;
};

// Global debug flag
let DEBUG_ENABLED = false;

// TCC config that users can pass
export type TCCConfig = {
  runId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
  debug?: boolean;
};

// Extended type for wrapped SDK that adds tcc parameter
export type WrappedSDK<T> = T extends { query: infer Q }
  ? Omit<T, "query"> & {
      query: (params: {
        prompt: Parameters<
          Q extends (...args: any) => any ? Q : never
        >[0]["prompt"];
        options?: Parameters<
          Q extends (...args: any) => any ? Q : never
        >[0]["options"];
        tcc?: TCCConfig;
      }) => ReturnType<Q extends (...args: any) => any ? Q : never>;
    }
  : T;

function instrumentQuery(queryFn: QueryFn, target: unknown): QueryFn {
  return new Proxy(queryFn, {
    apply(fn, thisArg, args) {
      const messages: SDKMessage[] = [];

      // Extract tcc config from query params
      const params = args[0] as any;
      const tccConfig: TCCConfig | undefined = params?.tcc;

      // Set global debug flag if enabled in config
      if (tccConfig?.debug) {
        DEBUG_ENABLED = true;
      }

      // Extract runId - check top level first, then metadata with tcc. prefix
      const runId =
        tccConfig?.runId ??
        (tccConfig?.metadata?.["tcc.runId"] as string | undefined) ??
        crypto.randomUUID();

      // Extract sessionId - check top level first, then metadata with tcc. prefix
      const sessionId =
        tccConfig?.sessionId ??
        (tccConfig?.metadata?.["tcc.sessionId"] as string | undefined) ??
        null;

      // Build final metadata: user metadata only (no tcc.* fields)
      const metadata: Record<string, unknown> = tccConfig?.metadata || {};

      if (DEBUG_ENABLED) {
        console.log("[TCC Debug] Query wrapper called");
        console.log("[TCC Debug] runId:", runId);
        console.log("[TCC Debug] sessionId:", sessionId);
        console.log("[TCC Debug] metadata:", metadata);
      }

      const wrappedGenerator = async function* () {
        try {
          if (DEBUG_ENABLED)
            console.log("[TCC Debug] Starting to collect messages");

          const generator = Reflect.apply(fn, thisArg || target, args);

          for await (const message of generator) {
            // Collect message with timestamp and tcc metadata
            messages.push({
              ...message,
              receivedAtMs: Date.now(),
              tccMetadata: { runId, sessionId }, // Attach to every message
            });

            if (DEBUG_ENABLED) {
              console.log(
                `[TCC Debug] Collected message type: ${message.type}, total: ${messages.length}`
              );
            }

            // Pass through transparently
            yield message;
          }

          // After stream completes, send telemetry
          if (messages.length > 0) {
            if (DEBUG_ENABLED) {
              console.log(
                `[TCC Debug] Stream completed with ${messages.length} messages`
              );
              console.log("[TCC Debug] Sending telemetry data...");
            }

            // Add user prompt to messages if it's a string
            const userPrompt =
              typeof params.prompt === "string" ? params.prompt : null;

            sendToAuthTagger({
              messages,
              customMetadata: metadata,
              runId,
              sessionId,
              userPrompt,
            }).catch((err) =>
              console.error("[TCC] Failed to send telemetry:", err)
            );
          }
        } catch (error) {
          // On error, try to send partial data
          if (messages.length > 0) {
            const userPrompt =
              typeof params.prompt === "string" ? params.prompt : null;
            sendToAuthTagger({
              messages,
              customMetadata: metadata,
              runId,
              sessionId,
              userPrompt,
            }).catch(() => {});
          }
          throw error;
        }
      };

      return wrappedGenerator();
    },
  }) as QueryFn;
}

function instrumentTool(toolDef: ToolDefinition): ToolDefinition {
  const originalHandler = toolDef.handler;

  return {
    ...toolDef,
    handler: async (args: any, extra: any) => {
      if (DEBUG_ENABLED) {
        console.log(`[TCC Debug] Tool call: ${toolDef.name}`, args);
      }
      const result = await originalHandler(args, extra);
      if (DEBUG_ENABLED) {
        console.log(`[TCC Debug] Tool result: ${toolDef.name}`, result);
      }
      return result;
    },
  };
}

async function sendToAuthTagger(payload: {
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

  if (DEBUG_ENABLED) {
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
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text}`);
    }

    if (DEBUG_ENABLED) {
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
      // Return cached value if available
      if (cache.has(prop)) {
        return cache.get(prop);
      }

      const value = Reflect.get(target, prop, receiver);

      // Wrap query function
      if (prop === "query" && typeof value === "function") {
        const wrapped = instrumentQuery(value as QueryFn, target);
        cache.set(prop, wrapped);
        return wrapped;
      }

      // Wrap tool factory
      if (prop === "tool" && typeof value === "function") {
        const wrapped = new Proxy(value, {
          apply(toolFn, thisArg, argArray) {
            const invocationTarget =
              thisArg === receiver || thisArg === undefined ? target : thisArg;

            const toolDef = Reflect.apply(toolFn, invocationTarget, argArray);

            // Wrap the tool if it has a handler
            if (
              toolDef &&
              typeof toolDef === "object" &&
              "handler" in toolDef
            ) {
              return instrumentTool(toolDef as ToolDefinition);
            }

            return toolDef;
          },
        });
        cache.set(prop, wrapped);
        return wrapped;
      }

      // Bind other functions
      if (typeof value === "function") {
        const bound = (value as Function).bind(target);
        cache.set(prop, bound);
        return bound;
      }

      return value;
    },
  }) as WrappedSDK<T>;
}

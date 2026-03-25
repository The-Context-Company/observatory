import {
  debugLog,
  enrichClaudeMessage,
  resolveTCCConfig,
  sendToClaudeIngestion,
  type SDKMessage,
  type TCCConfig,
} from "./core";

type QueryFn = (
  ...args: unknown[]
) => AsyncGenerator<SDKMessage, void, unknown>;
type ToolDefinition = {
  name: string;
  description: string;
  handler: (args: any, extra: any) => Promise<any>;
  [key: string]: any;
};

export type { TCCConfig } from "./core";

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
      const resolvedTcc = resolveTCCConfig(params?.tcc as TCCConfig | undefined);

      debugLog("Query wrapper called");
      debugLog("runId:", resolvedTcc.runId);
      debugLog("sessionId:", resolvedTcc.sessionId);
      debugLog("metadata:", resolvedTcc.metadata);

      const wrappedGenerator = async function* () {
        try {
          debugLog("Starting to collect messages");

          const generator = Reflect.apply(fn, thisArg || target, args);

          for await (const message of generator) {
            messages.push(
              enrichClaudeMessage(message, {
                runId: resolvedTcc.runId,
                sessionId: resolvedTcc.sessionId,
              })
            );

            debugLog(
              `Collected message type: ${message.type}, total: ${messages.length}`
            );

            // Pass through transparently
            yield message;
          }

          // After stream completes, send telemetry
          if (messages.length > 0) {
            debugLog(`Stream completed with ${messages.length} messages`);
            debugLog("Sending telemetry data...");

            // Add user prompt to messages if it's a string
            const userPrompt =
              typeof params.prompt === "string" ? params.prompt : null;

            sendToClaudeIngestion({
              messages,
              customMetadata: resolvedTcc.metadata,
              runId: resolvedTcc.runId,
              sessionId: resolvedTcc.sessionId,
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
            sendToClaudeIngestion({
              messages,
              customMetadata: resolvedTcc.metadata,
              runId: resolvedTcc.runId,
              sessionId: resolvedTcc.sessionId,
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
      debugLog(`Tool call: ${toolDef.name}`, args);
      const result = await originalHandler(args, extra);
      debugLog(`Tool result: ${toolDef.name}`, result);
      return result;
    },
  };
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

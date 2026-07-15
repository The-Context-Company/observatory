import { OpenTelemetry, type OpenTelemetryOptions } from "@ai-sdk/otel";
import { registerTelemetry } from "ai";

const REGISTRATION_KEY = Symbol.for("@contextcompany/ai-sdk.telemetry");

type Primitive = string | number | boolean;
export type MetadataValue =
  | Primitive
  | Primitive[]
  | null
  | undefined
  | Record<string, unknown>;

export type TCCTelemetryOptions = {
  runId: string;
  sessionId?: string;
  conversational?: boolean;
  agent?: string;
  userId?: string;
  userName?: string;
  orgId?: string;
  orgName?: string;
  metadata?: Record<string, MetadataValue>;
};

export type TCCTelemetryConfig = {
  runtimeContext: Record<string, unknown>;
  telemetry: { includeRuntimeContext: Record<string, true> };
};

export type TCCTelemetryIntegrationOptions = Omit<
  OpenTelemetryOptions,
  "runtimeContext" | "enrichSpan"
> & {
  enrichSpan?: OpenTelemetryOptions["enrichSpan"];
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function tccTelemetry(options: TCCTelemetryOptions): TCCTelemetryConfig {
  if (!UUID_PATTERN.test(options.runId)) {
    throw new Error("TCC: runId must be a valid UUID");
  }

  for (const key of Object.keys(options.metadata ?? {})) {
    if (key.startsWith("tcc.")) {
      throw new Error(`TCC: metadata key ${key} is reserved`);
    }
  }

  const runtimeContext: Record<string, unknown> = {
    ...(options.metadata ?? {}),
    "tcc.runId": options.runId,
  };
  const fields = {
    "tcc.sessionId": options.sessionId,
    "tcc.conversational": options.conversational,
    "tcc.agent": options.agent,
    "tcc.userId": options.userId,
    "tcc.userName": options.userName,
    "tcc.orgId": options.orgId,
    "tcc.orgName": options.orgName,
  };
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) runtimeContext[key] = value;
  }

  return {
    runtimeContext,
    telemetry: {
      includeRuntimeContext: Object.fromEntries(
        Object.keys(runtimeContext).map((key) => [key, true] as const)
      ),
    },
  };
}

export function registerAISDKTelemetry(
  options: TCCTelemetryIntegrationOptions = {}
): void {
  const state = globalThis as any;
  if (state[REGISTRATION_KEY]) return;

  const { enrichSpan, ...otelOptions } = options;
  registerTelemetry(
    new OpenTelemetry({
      ...otelOptions,
      runtimeContext: true,
      embedding: true,
      reranking: true,
      enrichSpan(context) {
        return {
          ...(enrichSpan?.(context) ?? {}),
          "tcc.span.type": context.spanType,
        };
      },
    })
  );
  state[REGISTRATION_KEY] = true;
}

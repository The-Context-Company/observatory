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

type LegacyTCCFields = {
  sessionId?: string;
  conversational?: boolean;
  agent?: string;
  userId?: string;
  userName?: string;
  orgId?: string;
  orgName?: string;
};

export type TCCTelemetryMetadata = Record<string, MetadataValue> & {
  "tcc.runId"?: string;
  "tcc.sessionId"?: string;
  "tcc.conversational"?: boolean | string;
  "tcc.agent"?: string;
  "tcc.userId"?: string;
  "tcc.userName"?: string;
  "tcc.orgId"?: string;
  "tcc.orgName"?: string;
};

export type TCCTelemetryOptions = LegacyTCCFields &
  (
    | {
        runId: string;
        metadata?: TCCTelemetryMetadata;
      }
    | {
        runId?: string;
        metadata: TCCTelemetryMetadata & { "tcc.runId": string };
      }
  );

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

const TCC_METADATA_KEYS = new Set([
  "tcc.runId",
  "tcc.sessionId",
  "tcc.conversational",
  "tcc.agent",
  "tcc.userId",
  "tcc.userName",
  "tcc.orgId",
  "tcc.orgName",
]);

export function tccTelemetry(options: TCCTelemetryOptions): TCCTelemetryConfig {
  for (const key of Object.keys(options.metadata ?? {})) {
    if (key.startsWith("tcc.") && !TCC_METADATA_KEYS.has(key)) {
      throw new Error(`TCC: unsupported metadata key ${key}`);
    }
  }

  const runId = options.metadata?.["tcc.runId"] ?? options.runId;
  if (typeof runId !== "string" || !UUID_PATTERN.test(runId)) {
    throw new Error("TCC: metadata tcc.runId must be a valid UUID");
  }

  const runtimeContext: Record<string, unknown> = {
    ...(options.metadata ?? {}),
    "tcc.runId": runId,
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
    if (!(key in runtimeContext) && value !== undefined) {
      runtimeContext[key] = value;
    }
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

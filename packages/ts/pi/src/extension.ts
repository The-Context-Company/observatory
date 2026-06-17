import { createPiTelemetryListener } from "./instrument";
import { setDebug } from "./logger";
import type { TCCPiConfig } from "./types";

type PiExtensionApi = {
  on: (
    event: string,
    handler: (event: unknown, ctx: PiExtensionContext) => unknown
  ) => void;
  registerCommand?: (
    name: string,
    options: {
      description?: string;
      handler: (args: unknown, ctx: PiExtensionContext) => unknown;
    }
  ) => void;
};

type PiExtensionContext = {
  cwd?: string;
  sessionManager?: {
    getSessionFile?: () => string | undefined;
  };
};

function envFlag(value: string | undefined): boolean {
  return value === "1" || value === "true" || value === "yes";
}

function loadConfig(): TCCPiConfig {
  const metadata: Record<string, unknown> = {};

  if (process.env.TCC_AGENT_NAME) {
    metadata["tcc.agent"] = process.env.TCC_AGENT_NAME;
  }
  if (process.env.TCC_USER_ID) {
    metadata["tcc.userId"] = process.env.TCC_USER_ID;
  }
  if (process.env.TCC_USER_NAME) {
    metadata["tcc.userName"] = process.env.TCC_USER_NAME;
  }
  if (process.env.TCC_ORG_ID) {
    metadata["tcc.orgId"] = process.env.TCC_ORG_ID;
  }
  if (process.env.TCC_ORG_NAME) {
    metadata["tcc.orgName"] = process.env.TCC_ORG_NAME;
  }

  return {
    endpoint: process.env.TCC_PI_ENDPOINT,
    sessionId: process.env.TCC_SESSION_ID,
    conversational: process.env.TCC_CONVERSATIONAL
      ? envFlag(process.env.TCC_CONVERSATIONAL)
      : true,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    debug: envFlag(process.env.TCC_DEBUG),
  };
}

function mergeEvent(
  type: string,
  event: unknown
): { type: string; [key: string]: unknown } {
  if (event && typeof event === "object") {
    return { type, ...(event as Record<string, unknown>) };
  }
  return { type };
}

export default function tccPiExtension(pi: PiExtensionApi): void {
  const config = loadConfig();
  if (config.debug) setDebug(true);

  const telemetry = createPiTelemetryListener(config);
  const forward = (type: string) => (event: unknown) => {
    telemetry.listener(mergeEvent(type, event));
  };

  pi.on("agent_start", forward("agent_start"));
  pi.on("message_end", forward("message_end"));
  pi.on("tool_execution_start", forward("tool_execution_start"));
  pi.on("tool_execution_update", forward("tool_execution_update"));
  pi.on("tool_execution_end", forward("tool_execution_end"));
  pi.on("agent_end", forward("agent_end"));
  pi.on("session_shutdown", async () => {
    await telemetry.flush();
  });

  pi.registerCommand?.("tcc-status", {
    description: "Show The Context Company telemetry status",
    handler: async () => {
      await telemetry.flush();
      const lastRunId = telemetry.getLastRunId();
      return lastRunId
        ? `TCC telemetry is active. Last run ID: ${lastRunId}`
        : "TCC telemetry is active. No Pi agent run has completed yet.";
    },
  });
}

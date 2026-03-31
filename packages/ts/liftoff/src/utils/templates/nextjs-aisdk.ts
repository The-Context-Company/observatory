import type { WizardContext } from "../../types.js";
import type { TemplateResult } from "./types.js";

function getInstrumentationContent(typescript: boolean): string {
  if (typescript) {
    return `export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerOTelTCC } = await import("@contextcompany/otel/nextjs");
    // tcc.conversational: true -- set to false if your agent does not
    // maintain conversation history between runs
    registerOTelTCC();
  }
}

// TODO: Wire your session/conversation/thread ID as tcc.sessionId
// if your app groups messages into conversations.
`;
  }

  return `export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerOTelTCC } = require("@contextcompany/otel/nextjs");
    // tcc.conversational: true -- set to false if your agent does not
    // maintain conversation history between runs
    registerOTelTCC();
  }
}

// TODO: Wire your session/conversation/thread ID as tcc.sessionId
// if your app groups messages into conversations.
`;
}

export function getTemplate(ctx: WizardContext): TemplateResult {
  const ext = ctx.typescript ? "ts" : "js";
  const prefix = ctx.srcDir ? "src/" : "";

  return {
    files: [
      {
        filePath: `${prefix}instrumentation.${ext}`,
        action: "create",
        content: getInstrumentationContent(ctx.typescript ?? true),
        description:
          "Next.js instrumentation file that registers TCC OpenTelemetry on server startup",
      },
    ],
    gotchaFixes: [],
  };
}

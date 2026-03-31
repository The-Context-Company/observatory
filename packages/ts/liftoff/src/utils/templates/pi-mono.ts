import type { WizardContext } from "../../types.js";
import type { TemplateResult } from "./types.js";

function getInstrumentationContent(typescript: boolean): string {
  if (typescript) {
    return `import { instrumentPiSession } from "@contextcompany/pi";

// TCC: Instrument your Pi agent session with observability.
//
// Usage:
//   import { instrumentPiSession } from "./tcc-instrumentation.js";
//
//   const session = await piAgent.createSession();
//   instrumentPiSession(session);
//   // All subsequent session events are now tracked by TCC.
//
// tcc.conversational: true -- set to false if your agent does not
// maintain conversation history between runs
//
// TODO: Wire your session/conversation/thread ID as tcc.sessionId
// if your app groups messages into conversations.

export { instrumentPiSession };
`;
  }

  return `const { instrumentPiSession } = require("@contextcompany/pi");

// TCC: Instrument your Pi agent session with observability.
//
// Usage:
//   const { instrumentPiSession } = require("./tcc-instrumentation");
//
//   const session = await piAgent.createSession();
//   instrumentPiSession(session);
//   // All subsequent session events are now tracked by TCC.
//
// tcc.conversational: true -- set to false if your agent does not
// maintain conversation history between runs
//
// TODO: Wire your session/conversation/thread ID as tcc.sessionId
// if your app groups messages into conversations.

module.exports = { instrumentPiSession };
`;
}

export function getTemplate(ctx: WizardContext): TemplateResult {
  const ext = ctx.typescript ? "ts" : "js";
  const prefix = ctx.srcDir ? "src/" : "";

  return {
    files: [
      {
        filePath: `${prefix}tcc-instrumentation.${ext}`,
        action: "create",
        content: getInstrumentationContent(ctx.typescript ?? true),
        description:
          "Pi-Mono instrumentation helper that re-exports instrumentPiSession for easy wiring",
      },
    ],
    gotchaFixes: [],
  };
}

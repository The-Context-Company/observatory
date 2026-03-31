import type { WizardContext } from "../../types.js";
import type { TemplateResult } from "./types.js";

function getInstrumentationContent(typescript: boolean): string {
  if (typescript) {
    return `import tccPlugin, { register } from "@contextcompany/openclaw";

// TCC: Register the OpenClaw plugin for observability.
//
// Usage (as default export):
//   import tccPlugin from "./tcc-instrumentation.js";
//   const agent = new OpenClaw({ plugins: [tccPlugin] });
//
// Usage (register function):
//   import { register } from "./tcc-instrumentation.js";
//   register(agentInstance);
//
// tcc.conversational: true -- set to false if your agent does not
// maintain conversation history between runs
//
// TODO: Wire your session/conversation/thread ID as tcc.sessionId
// if your app groups messages into conversations.

export default tccPlugin;
export { register };
`;
  }

  return `const tccPlugin = require("@contextcompany/openclaw");
const { register } = tccPlugin;

// TCC: Register the OpenClaw plugin for observability.
//
// Usage:
//   const tccPlugin = require("./tcc-instrumentation");
//   const agent = new OpenClaw({ plugins: [tccPlugin] });
//
// tcc.conversational: true -- set to false if your agent does not
// maintain conversation history between runs
//
// TODO: Wire your session/conversation/thread ID as tcc.sessionId
// if your app groups messages into conversations.

module.exports = tccPlugin;
module.exports.register = register;
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
          "OpenClaw TCC plugin re-export for easy registration with OpenClaw agents",
      },
    ],
    gotchaFixes: [],
  };
}

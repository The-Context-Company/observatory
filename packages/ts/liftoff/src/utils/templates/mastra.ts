import type { WizardContext } from "../../types.js";
import type { TemplateResult } from "./types.js";

function getInstrumentationContent(typescript: boolean): string {
  if (typescript) {
    return `import { TCCMastraExporter } from "@contextcompany/mastra";

// TCC: Use this exporter in your Mastra config:
//
// import { Mastra } from "@mastra/core/mastra";
//
// export const mastra = new Mastra({
//   agents: { /* your agents */ },
//   observability: {
//     configs: {
//       otel: {
//         serviceName: "my-agent",
//         exporters: [new TCCMastraExporter({})],
//       },
//     },
//   },
// });
//
// tcc.conversational: true -- set to false if your agent does not
// maintain conversation history between runs
//
// TODO: Wire your session/conversation/thread ID as tcc.sessionId
// if your app groups messages into conversations.

export { TCCMastraExporter };
`;
  }

  return `const { TCCMastraExporter } = require("@contextcompany/mastra");

// TCC: Use this exporter in your Mastra config.
// See docs: https://docs.thecontext.company/frameworks/mastra/setup
//
// tcc.conversational: true -- set to false if your agent does not
// maintain conversation history between runs
//
// TODO: Wire your session/conversation/thread ID as tcc.sessionId
// if your app groups messages into conversations.

module.exports = { TCCMastraExporter };
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
          "TCCMastraExporter helper file for Mastra observability config",
      },
    ],
    gotchaFixes: [],
  };
}

import type { WizardContext } from "../../types.js";
import type { TemplateResult } from "./types.js";

function getInstrumentationContent(typescript: boolean): string {
  if (typescript) {
    return `import { TCCCallbackHandler, setGlobalHandler } from "@contextcompany/langchain";

// TCC: Initialize global observability for all LangChain / LangGraph calls.
// Import this file at the top of your entry point:
//   import "./tcc-instrumentation.js";
//
// tcc.conversational: true -- set to false if your agent does not
// maintain conversation history between runs
//
// TODO: Wire your session/conversation/thread ID as tcc.sessionId
// if your app groups messages into conversations.
setGlobalHandler(new TCCCallbackHandler());
`;
  }

  return `const { TCCCallbackHandler, setGlobalHandler } = require("@contextcompany/langchain");

// TCC: Initialize global observability for all LangChain / LangGraph calls.
// Require this file at the top of your entry point:
//   require("./tcc-instrumentation");
//
// tcc.conversational: true -- set to false if your agent does not
// maintain conversation history between runs
//
// TODO: Wire your session/conversation/thread ID as tcc.sessionId
// if your app groups messages into conversations.
setGlobalHandler(new TCCCallbackHandler());
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
          "LangChain/LangGraph global callback handler for TCC observability",
      },
    ],
    gotchaFixes: [],
  };
}

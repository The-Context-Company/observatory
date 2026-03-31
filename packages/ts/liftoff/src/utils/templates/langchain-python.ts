import type { WizardContext } from "../../types.js";
import type { TemplateResult } from "./types.js";

function getInstrumentationContent(): string {
  return `"""TCC Instrumentation for LangChain.

Import this at the top of your entry point:
    from tcc_instrumentation import *  # noqa
"""
from contextcompany.langchain import instrument_langchain

instrument_langchain()

# tcc.conversational: true by default. Set to False if your agent
# does not maintain conversation history between runs.

# TODO: Wire your session/conversation/thread ID as tcc.sessionId
# if your app groups messages into conversations.
`;
}

export function getTemplate(ctx: WizardContext): TemplateResult {
  const prefix = ctx.srcDir ? "src/" : "";

  return {
    files: [
      {
        filePath: `${prefix}tcc_instrumentation.py`,
        action: "create",
        content: getInstrumentationContent(),
        description:
          "LangChain Python instrumentation that auto-instruments all LangChain calls",
      },
    ],
    gotchaFixes: [],
  };
}

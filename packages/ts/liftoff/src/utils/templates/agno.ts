import type { WizardContext } from "../../types.js";
import type { TemplateResult } from "./types.js";

function getInstrumentationContent(): string {
  return `"""TCC Instrumentation for Agno.

Import this at the top of your entry point:
    from tcc_instrumentation import *  # noqa
"""
from contextcompany.agno import instrument_agno

instrument_agno()

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
          "Agno instrumentation that auto-instruments all Agno agent calls",
      },
    ],
    gotchaFixes: [],
  };
}

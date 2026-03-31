import type { WizardContext } from "../../types.js";
import type { TemplateResult } from "./types.js";

function getInstrumentationContent(): string {
  return `"""TCC Instrumentation for CrewAI.

Import this at the top of your entry point:
    from tcc_instrumentation import *  # noqa
"""
from contextcompany.crewai import instrument_crewai

instrument_crewai()

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
          "CrewAI instrumentation that auto-instruments all CrewAI agent calls",
      },
    ],
    gotchaFixes: [],
  };
}

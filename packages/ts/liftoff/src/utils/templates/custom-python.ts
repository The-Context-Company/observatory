import type { WizardContext } from "../../types.js";
import type { TemplateResult } from "./types.js";

function getInstrumentationContent(): string {
  return `"""TCC Instrumentation for custom Python agents.

Import helpers from this module:
    from tcc_instrumentation import run, step, tool_call, send_run
"""
from contextcompany import run, step, tool_call, send_run

# tcc.conversational: true by default. Set to False if your agent
# does not maintain conversation history between runs.

# TODO: Wire your session/conversation/thread ID as tcc.sessionId
# if your app groups messages into conversations.

# Example usage:
#
#   r = run(session_id="conv-123", conversational=True)
#   r.prompt("What is the weather?")
#
#   s = step(name="lookup")
#   tc = tool_call(name="get_weather", input={"city": "SF"})
#   tc.output({"temp": 72})
#   s.add_tool_call(tc)
#   r.add_step(s)
#
#   r.response("It is 72F in San Francisco.")
#   send_run(r)
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
          "Custom Python instrumentation helpers with run/step/tool_call/send_run builder pattern",
      },
    ],
    gotchaFixes: [],
  };
}

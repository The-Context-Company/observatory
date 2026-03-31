import type { WizardContext } from "../../types.js";
import type { TemplateResult } from "./types.js";

function getInstrumentationContent(typescript: boolean): string {
  if (typescript) {
    return `import { configure, run, sendRun } from "@contextcompany/custom";

// TCC: Configure the custom instrumentation SDK.
// Set debug: true to see detailed logs during development.
configure({ debug: true });

// tcc.conversational: true -- set to false if your agent does not
// maintain conversation history between runs
//
// TODO: Wire your session/conversation/thread ID as tcc.sessionId
// if your app groups messages into conversations.

/**
 * Example: Wrap your agent call with TCC observability.
 *
 * Usage:
 *   import { traceAgentCall } from "./tcc-instrumentation.js";
 *   const response = await traceAgentCall("user question", myAgentFn);
 */
export async function traceAgentCall(
  userPrompt: string,
  agentFn: (prompt: string) => Promise<string>,
): Promise<string> {
  const r = run({ sessionId: crypto.randomUUID(), conversational: true });
  r.prompt(userPrompt);

  try {
    const response = await agentFn(userPrompt);
    r.response(response);
    await r.end();
    return response;
  } catch (err) {
    await r.error(String(err));
    throw err;
  }
}

// Re-export for direct use
export { run, sendRun, configure };
`;
  }

  return `const { configure, run, sendRun } = require("@contextcompany/custom");

// TCC: Configure the custom instrumentation SDK.
configure({ debug: true });

// tcc.conversational: true -- set to false if your agent does not
// maintain conversation history between runs
//
// TODO: Wire your session/conversation/thread ID as tcc.sessionId
// if your app groups messages into conversations.

/**
 * Example: Wrap your agent call with TCC observability.
 */
async function traceAgentCall(userPrompt, agentFn) {
  const r = run({ sessionId: crypto.randomUUID(), conversational: true });
  r.prompt(userPrompt);

  try {
    const response = await agentFn(userPrompt);
    r.response(response);
    await r.end();
    return response;
  } catch (err) {
    await r.error(String(err));
    throw err;
  }
}

module.exports = { traceAgentCall, run, sendRun, configure };
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
          "Custom instrumentation helpers with configure/run/sendRun and example traceAgentCall wrapper",
      },
    ],
    gotchaFixes: [],
  };
}

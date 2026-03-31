import type { WizardContext } from "../../types.js";
import type { TemplateResult } from "./types.js";

function getInstrumentationContent(typescript: boolean): string {
  if (typescript) {
    return `import { instrumentClaudeAgent } from "@contextcompany/claude";
import * as claudeSDK from "@anthropic-ai/claude-agent-sdk";

// TCC: Wrapped Claude Agent SDK with observability instrumentation.
// Import { query, tool, createSdkMcpServer } from this file instead of
// importing directly from "@anthropic-ai/claude-agent-sdk".
//
// tcc.conversational: true -- set to false if your agent does not
// maintain conversation history between runs
//
// TODO: Wire your session/conversation/thread ID as tcc.sessionId
// if your app groups messages into conversations.
export const { query, tool, createSdkMcpServer } = instrumentClaudeAgent(claudeSDK);
`;
  }

  return `const { instrumentClaudeAgent } = require("@contextcompany/claude");
const claudeSDK = require("@anthropic-ai/claude-agent-sdk");

// TCC: Wrapped Claude Agent SDK with observability instrumentation.
// Import { query, tool, createSdkMcpServer } from this file instead of
// importing directly from "@anthropic-ai/claude-agent-sdk".
//
// tcc.conversational: true -- set to false if your agent does not
// maintain conversation history between runs
//
// TODO: Wire your session/conversation/thread ID as tcc.sessionId
// if your app groups messages into conversations.
const { query, tool, createSdkMcpServer } = instrumentClaudeAgent(claudeSDK);
module.exports = { query, tool, createSdkMcpServer };
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
          "Claude Agent SDK wrapper that re-exports query/tool/createSdkMcpServer with TCC observability",
      },
    ],
    gotchaFixes: [],
  };
}

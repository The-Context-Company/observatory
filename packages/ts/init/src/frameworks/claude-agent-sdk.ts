import path from "node:path";
import { execSync } from "node:child_process";
import * as p from "@clack/prompts";
import pc from "picocolors";
import type { WizardContext } from "../types.js";
import { getInstallCommand } from "../utils/package-manager.js";
import {
  fileExists,
  writeFile,
  getTCCInstrumentationPath,
} from "../utils/file-utils.js";
import {
  ensureEnvFile,
  setEnvVariable,
  ensureGitignore,
  getEnvFilename,
} from "../utils/env.js";

function getInstrumentationContent(typescript: boolean): string {
  if (typescript) {
    return `import { instrumentClaudeAgent } from "@contextcompany/claude";
import * as claudeSDK from "@anthropic-ai/claude-agent-sdk";

// TCC: Wrapped Claude Agent SDK with observability instrumentation.
// Import { query, tool, createSdkMcpServer } from this file instead of
// importing directly from "@anthropic-ai/claude-agent-sdk".
export const { query, tool, createSdkMcpServer } = instrumentClaudeAgent(claudeSDK);
`;
  }

  return `const { instrumentClaudeAgent } = require("@contextcompany/claude");
const claudeSDK = require("@anthropic-ai/claude-agent-sdk");

// TCC: Wrapped Claude Agent SDK with observability instrumentation.
// Import { query, tool, createSdkMcpServer } from this file instead of
// importing directly from "@anthropic-ai/claude-agent-sdk".
const { query, tool, createSdkMcpServer } = instrumentClaudeAgent(claudeSDK);
module.exports = { query, tool, createSdkMcpServer };
`;
}

export async function setup(ctx: WizardContext): Promise<void> {
  const packages = ["@contextcompany/claude"];

  // Step 1: Install dependencies
  const s = p.spinner();
  s.start(`Installing ${packages.join(", ")}...`);

  try {
    const cmd = getInstallCommand(ctx.packageManager, packages);
    execSync(cmd, { cwd: ctx.installDir, stdio: "pipe" });
    s.stop(`Installed ${packages.join(", ")}`);
  } catch {
    s.stop(pc.red("Failed to install dependencies"));
    p.log.error(
      `Could not install packages. Run manually:\n  ${getInstallCommand(ctx.packageManager, packages)}`,
    );
    return;
  }

  // Step 2: Create TCC instrumentation file
  const instrPath = getTCCInstrumentationPath(
    ctx.installDir,
    ctx.typescript,
    ctx.srcDir,
  );
  const instrRelative = path.relative(ctx.installDir, instrPath);

  if (fileExists(instrPath)) {
    p.log.warn(`${pc.cyan(instrRelative)} already exists — skipping.`);
  } else {
    writeFile(instrPath, getInstrumentationContent(ctx.typescript));
    p.log.success(`Created ${pc.cyan(instrRelative)}`);
  }

  // Step 3: Set up environment variables
  const envFilename = getEnvFilename(false);
  const envPath = ensureEnvFile(ctx.installDir, false);
  if (ctx.apiKey) {
    setEnvVariable(envPath, "TCC_API_KEY", ctx.apiKey);
  } else {
    setEnvVariable(envPath, "TCC_API_KEY", "");
  }
  ensureGitignore(ctx.installDir, envFilename);
  p.log.success(`Added ${pc.cyan("TCC_API_KEY")} to ${pc.cyan(envFilename)}`);

  // Step 4: Next steps
  p.note(
    [
      `${pc.bold("1.")} Replace your Claude Agent SDK imports with:`,
      "",
      pc.cyan(`   import { query, tool, createSdkMcpServer } from "./${path.basename(instrPath, path.extname(instrPath))}.js";`),
      "",
      `   This re-exports the SDK wrapped with TCC observability.`,
      "",
      ...(ctx.apiKey
        ? []
        : [
            `${pc.bold("2.")} Add your TCC API key to ${pc.cyan(envFilename)}`,
            `   Get one at ${pc.underline("https://app.thecontext.company")}`,
            "",
          ]),
      `${pc.dim("Docs:")} ${pc.underline("https://docs.thecontext.company/frameworks/claude-agent-sdk")}`,
    ].join("\n"),
    "Next steps",
  );
}

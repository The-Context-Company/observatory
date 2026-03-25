import { execSync } from "node:child_process";
import * as p from "@clack/prompts";
import pc from "picocolors";
import type { WizardContext } from "../types.js";
import { getInstallCommand } from "../utils/package-manager.js";
import {
  ensureEnvFile,
  setEnvVariable,
  ensureGitignore,
  getEnvFilename,
} from "../utils/env.js";

export async function setup(ctx: WizardContext): Promise<void> {
  const packages = ["@contextcompany/claude"];

  // Step 1: Install dependencies
  const s = p.spinner();
  s.start(`Installing ${packages.join(", ")}...`);

  try {
    const cmd = getInstallCommand(ctx.packageManager, packages);
    execSync(cmd, {
      cwd: ctx.installDir,
      stdio: "pipe",
    });
    s.stop(`Installed ${packages.join(", ")}`);
  } catch {
    s.stop(pc.red("Failed to install dependencies"));
    p.log.error(
      `Could not install packages. Run manually:\n  ${getInstallCommand(ctx.packageManager, packages)}`,
    );
    return;
  }

  // Step 2: Set up environment variables
  const envFilename = getEnvFilename(false);
  const envPath = ensureEnvFile(ctx.installDir, false);

  if (ctx.apiKey) {
    setEnvVariable(envPath, "TCC_API_KEY", ctx.apiKey);
  } else {
    setEnvVariable(envPath, "TCC_API_KEY", "");
  }

  ensureGitignore(ctx.installDir, envFilename);
  p.log.success(`Added ${pc.cyan("TCC_API_KEY")} to ${pc.cyan(envFilename)}`);

  // Step 3: Show usage instructions and next steps
  const usageCode = `import { instrumentClaudeAgent } from "@contextcompany/claude";
import * as claudeSDK from "@anthropic-ai/claude-agent-sdk";

const { query, tool, createSdkMcpServer } = instrumentClaudeAgent(claudeSDK);

// Now use query, tool, and createSdkMcpServer as you normally would`;

  p.note(
    [
      `${pc.bold("1.")} Wrap the Claude Agent SDK with TCC instrumentation:`,
      "",
      pc.dim(usageCode),
      "",
      ...(ctx.apiKey
        ? []
        : [
            `${pc.bold("2.")} Add your TCC API key to ${pc.cyan(".env")}`,
            `   Get one at ${pc.underline("https://app.thecontext.company")}`,
            "",
          ]),
      `${pc.dim("Docs:")} ${pc.underline("https://docs.thecontext.company/frameworks/claude-agent-sdk")}`,
    ].join("\n"),
    "Next steps",
  );
}

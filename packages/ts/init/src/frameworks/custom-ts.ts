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
    return `import { configure, run, sendRun } from "@contextcompany/custom";

// TCC: Configure the custom instrumentation SDK.
// Set debug: true to see detailed logs during development.
configure({ debug: true });

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

export async function setup(ctx: WizardContext): Promise<void> {
  const packages = ["@contextcompany/custom"];

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

  // Step 2: Create TCC instrumentation file with example helpers
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
  const importExample = ctx.typescript
    ? `import { traceAgentCall } from "./${path.basename(instrPath, path.extname(instrPath))}.js";`
    : `const { traceAgentCall } = require("./${path.basename(instrPath, path.extname(instrPath))}");`;

  p.note(
    [
      `${pc.bold("1.")} Use the helper to wrap your agent calls:`,
      "",
      pc.cyan(`   ${importExample}`),
      "",
      pc.cyan(`   const response = await traceAgentCall("user question", myAgent);`),
      "",
      `   Or use ${pc.cyan("run()")} directly for full control — see ${pc.cyan(instrRelative)}.`,
      "",
      ...(ctx.apiKey
        ? []
        : [
            `${pc.bold("2.")} Add your TCC API key to ${pc.cyan(envFilename)}`,
            `   Get one at ${pc.underline("https://app.thecontext.company")}`,
            "",
          ]),
      `${pc.dim("Docs:")} ${pc.underline("https://docs.thecontext.company/")}`,
    ].join("\n"),
    "Next steps",
  );
}

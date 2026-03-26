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
    return `import { TCCCallbackHandler, setGlobalHandler } from "@contextcompany/langchain";

// TCC: Initialize global observability for all LangChain / LangGraph calls.
// Import this file at the top of your entry point:
//   import "./tcc-instrumentation.js";
setGlobalHandler(new TCCCallbackHandler());
`;
  }

  return `const { TCCCallbackHandler, setGlobalHandler } = require("@contextcompany/langchain");

// TCC: Initialize global observability for all LangChain / LangGraph calls.
// Require this file at the top of your entry point:
//   require("./tcc-instrumentation");
setGlobalHandler(new TCCCallbackHandler());
`;
}

export async function setup(ctx: WizardContext): Promise<void> {
  const packages = ["@contextcompany/langchain"];

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
  const importLine = ctx.typescript
    ? `import "./${path.basename(instrPath, path.extname(instrPath))}.js";`
    : `require("./${path.basename(instrPath, path.extname(instrPath))}");`;

  p.note(
    [
      `${pc.bold("1.")} Add this import at the ${pc.bold("top")} of your entry file:`,
      "",
      pc.cyan(`   ${importLine}`),
      "",
      `   This enables global observability for all LangChain calls.`,
      "",
      ...(ctx.apiKey
        ? []
        : [
            `${pc.bold("2.")} Add your TCC API key to ${pc.cyan(envFilename)}`,
            `   Get one at ${pc.underline("https://app.thecontext.company")}`,
            "",
          ]),
      `${pc.dim("Docs:")} ${pc.underline("https://docs.thecontext.company/frameworks/langchain-langgraph")}`,
    ].join("\n"),
    "Next steps",
  );
}

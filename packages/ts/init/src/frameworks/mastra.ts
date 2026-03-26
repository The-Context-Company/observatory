import path from "node:path";
import { execSync } from "node:child_process";
import * as p from "@clack/prompts";
import pc from "picocolors";
import type { WizardContext } from "../types.js";
import { getInstallCommand } from "../utils/package-manager.js";
import {
  fileExists,
  readFile,
  writeFile,
  findFileContaining,
  getTCCInstrumentationPath,
} from "../utils/file-utils.js";
import {
  ensureEnvFile,
  setEnvVariable,
  ensureGitignore,
  getEnvFilename,
} from "../utils/env.js";

/**
 * Try to inject the TCCMastraExporter into an existing Mastra config file.
 *
 * Looks for a file containing `new Mastra(`, then:
 *  1. Adds the import for TCCMastraExporter
 *  2. Injects the observability config into the Mastra constructor
 *
 * Returns true if successful, false if the file couldn't be modified.
 */
function injectExporterIntoMastraConfig(configPath: string): boolean {
  const content = readFile(configPath);
  if (!content) return false;

  // Already instrumented?
  if (content.includes("TCCMastraExporter") || content.includes("@contextcompany/mastra")) {
    return false;
  }

  let modified = content;

  // 1. Add import at the top (after last existing import)
  const importStatement = 'import { TCCMastraExporter } from "@contextcompany/mastra";';
  const lastImportIndex = modified.lastIndexOf("import ");
  if (lastImportIndex !== -1) {
    const endOfImport = modified.indexOf("\n", lastImportIndex);
    if (endOfImport !== -1) {
      modified =
        modified.slice(0, endOfImport + 1) +
        importStatement +
        "\n" +
        modified.slice(endOfImport + 1);
    }
  } else {
    // No imports found — add at the very top
    modified = importStatement + "\n\n" + modified;
  }

  // 2. Inject observability config into new Mastra({...})
  // Look for `new Mastra({` and inject after the opening brace
  if (modified.includes("observability")) {
    // Already has observability config — don't touch it, user will need to add manually
    // But we still added the import, which is useful
    writeFile(configPath, modified);
    return true;
  }

  // Find `new Mastra({` and inject observability after the opening {
  const mastraCallRegex = /new\s+Mastra\s*\(\s*\{/;
  const match = mastraCallRegex.exec(modified);
  if (match && match.index !== undefined) {
    const insertPos = match.index + match[0].length;
    const observabilityConfig = `
  observability: {
    configs: {
      otel: {
        serviceName: "my-agent",
        exporters: [new TCCMastraExporter({})],
      },
    },
  },`;
    modified =
      modified.slice(0, insertPos) +
      observabilityConfig +
      modified.slice(insertPos);

    writeFile(configPath, modified);
    return true;
  }

  // Couldn't find the Mastra constructor pattern — just save with the import added
  writeFile(configPath, modified);
  return true;
}

function getFallbackInstrumentationContent(typescript: boolean): string {
  if (typescript) {
    return `import { TCCMastraExporter } from "@contextcompany/mastra";

// TCC: Use this exporter in your Mastra config:
//
// import { Mastra } from "@mastra/core/mastra";
//
// export const mastra = new Mastra({
//   agents: { /* your agents */ },
//   observability: {
//     configs: {
//       otel: {
//         serviceName: "my-agent",
//         exporters: [new TCCMastraExporter({})],
//       },
//     },
//   },
// });

export { TCCMastraExporter };
`;
  }

  return `const { TCCMastraExporter } = require("@contextcompany/mastra");

// TCC: Use this exporter in your Mastra config.
// See docs: https://docs.thecontext.company/frameworks/mastra/setup

module.exports = { TCCMastraExporter };
`;
}

export async function setup(ctx: WizardContext): Promise<void> {
  const packages = ["@contextcompany/mastra"];

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

  // Step 2: Try to find and modify the Mastra config file
  let injected = false;
  const mastraConfigPath = findFileContaining(ctx.installDir, "new Mastra(");

  if (mastraConfigPath) {
    const relativePath = path.relative(ctx.installDir, mastraConfigPath);
    injected = injectExporterIntoMastraConfig(mastraConfigPath);

    if (injected) {
      p.log.success(
        `Injected TCC exporter into ${pc.cyan(relativePath)}`,
      );
    } else {
      p.log.info(
        `${pc.cyan(relativePath)} already has TCC instrumentation.`,
      );
    }
  } else {
    // Fallback: create a helper file
    const instrPath = getTCCInstrumentationPath(
      ctx.installDir,
      ctx.typescript,
      ctx.srcDir,
    );
    const instrRelative = path.relative(ctx.installDir, instrPath);

    if (fileExists(instrPath)) {
      p.log.warn(`${pc.cyan(instrRelative)} already exists — skipping.`);
    } else {
      writeFile(instrPath, getFallbackInstrumentationContent(ctx.typescript));
      p.log.success(`Created ${pc.cyan(instrRelative)}`);
    }
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
  const lines: string[] = [];

  if (mastraConfigPath && injected) {
    lines.push(
      `${pc.bold("1.")} Review the changes in ${pc.cyan(path.relative(ctx.installDir, mastraConfigPath))}`,
    );
    lines.push(
      `   The TCC exporter has been added to your Mastra observability config.`,
    );
  } else if (!mastraConfigPath) {
    lines.push(
      `${pc.bold("1.")} Add the TCC exporter to your Mastra config:`,
    );
    lines.push("");
    lines.push(
      pc.cyan(`   exporters: [new TCCMastraExporter({})]`),
    );
    lines.push("");
    lines.push(
      `   inside ${pc.cyan("observability.configs.otel")} in your ${pc.cyan("new Mastra({...})")} call.`,
    );
  }

  if (!ctx.apiKey) {
    lines.push("");
    lines.push(
      `${pc.bold(mastraConfigPath && injected ? "2." : "2.")} Add your TCC API key to ${pc.cyan(envFilename)}`,
    );
    lines.push(
      `   Get one at ${pc.underline("https://app.thecontext.company")}`,
    );
  }

  lines.push("");
  lines.push(
    `${pc.dim("Docs:")} ${pc.underline("https://docs.thecontext.company/frameworks/mastra/setup")}`,
  );

  p.note(lines.join("\n"), "Next steps");
}

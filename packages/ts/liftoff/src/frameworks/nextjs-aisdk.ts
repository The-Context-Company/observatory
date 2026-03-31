import path from "node:path";
import { execSync } from "node:child_process";
import * as p from "@clack/prompts";
import pc from "picocolors";
import type { WizardContext } from "../types.js";
import { getInstallCommand, getRunDevCommand } from "../utils/package-manager.js";
import {
  fileExists,
  readFile,
  writeFile,
  findLayoutFile,
  findInstrumentationFile,
} from "../utils/file-utils.js";
import {
  ensureEnvFile,
  setEnvVariable,
  ensureGitignore,
  getEnvFilename,
} from "../utils/env.js";

// ── Instrumentation file content ──────────────────────────────────────

function getInstrumentationContent(mode: "cloud" | "local"): string {
  if (mode === "local") {
    return `export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerOTelTCC } = await import("@contextcompany/otel/nextjs");
    registerOTelTCC({ local: true });
  }
}
`;
  }

  return `export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerOTelTCC } = await import("@contextcompany/otel/nextjs");
    registerOTelTCC();
  }
}
`;
}

// ── Widget injection into layout ──────────────────────────────────────

function injectWidgetIntoLayout(layoutPath: string): boolean {
  const content = readFile(layoutPath);
  if (!content) return false;

  // Check if widget is already present
  if (content.includes("@contextcompany/widget")) {
    return false; // Already has widget
  }

  // Add Script import if not present
  let modified = content;
  if (!modified.includes('from "next/script"') && !modified.includes("from 'next/script'")) {
    // Add Script import after the last import statement
    const lastImportIndex = modified.lastIndexOf("import ");
    if (lastImportIndex !== -1) {
      const endOfImport = modified.indexOf("\n", lastImportIndex);
      if (endOfImport !== -1) {
        modified =
          modified.slice(0, endOfImport + 1) +
          'import Script from "next/script";\n' +
          modified.slice(endOfImport + 1);
      }
    }
  }

  // Inject widget Script tag into <head> if there's one, or after <html>
  if (modified.includes("<head>")) {
    // Add inside existing <head>
    modified = modified.replace(
      "<head>",
      `<head>
        {process.env.NODE_ENV === "development" && (
          <Script src="https://unpkg.com/@contextcompany/widget/dist/auto.global.js" />
        )}`,
    );
  } else if (modified.includes("<html")) {
    // Add a <head> with the widget after <html ...>
    const htmlTagEnd = modified.indexOf(">", modified.indexOf("<html"));
    if (htmlTagEnd !== -1) {
      modified =
        modified.slice(0, htmlTagEnd + 1) +
        `\n      <head>\n        {process.env.NODE_ENV === "development" && (\n          <Script src="https://unpkg.com/@contextcompany/widget/dist/auto.global.js" />\n        )}\n      </head>` +
        modified.slice(htmlTagEnd + 1);
    }
  }

  if (modified === content) return false; // No changes made

  writeFile(layoutPath, modified);
  return true;
}

// ── Main setup ────────────────────────────────────────────────────────

export async function setup(ctx: WizardContext): Promise<void> {
  const packages = ["@contextcompany/otel", "@vercel/otel", "@opentelemetry/api"];

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
  } catch (error) {
    s.stop(pc.red("Failed to install dependencies"));
    p.log.error(
      `Could not install packages. Run manually:\n  ${getInstallCommand(ctx.packageManager, packages)}`,
    );
    return;
  }

  // Step 2: Create instrumentation file
  const existingInstrumentation = findInstrumentationFile(ctx.installDir);

  if (existingInstrumentation) {
    p.log.warn(
      `Instrumentation file already exists at ${pc.cyan(path.relative(ctx.installDir, existingInstrumentation))}`,
    );
    p.log.info("Skipping instrumentation file creation. Please add TCC manually if needed.");
  } else {
    // Determine location: match project structure
    const ext = ctx.typescript ? "ts" : "js";
    const instrumentationFilename = ctx.srcDir
      ? `src/instrumentation.${ext}`
      : `instrumentation.${ext}`;
    const instrumentationPath = path.join(ctx.installDir, instrumentationFilename);

    writeFile(instrumentationPath, getInstrumentationContent(ctx.mode));
    p.log.success(`Created ${pc.cyan(instrumentationFilename)}`);
  }

  // Step 3: For local mode, inject widget into layout
  if (ctx.mode === "local") {
    const layoutPath = findLayoutFile(ctx.installDir);
    if (layoutPath) {
      const injected = injectWidgetIntoLayout(layoutPath);
      if (injected) {
        p.log.success(
          `Added widget script to ${pc.cyan(path.relative(ctx.installDir, layoutPath))}`,
        );
      } else {
        p.log.info("Widget script already present in layout (or could not inject).");
      }
    } else {
      p.log.warn("Could not find root layout file. Add the widget manually:");
      p.log.info(
        `  Add this inside <head> in your root layout:\n  ${pc.cyan('<Script src="https://unpkg.com/@contextcompany/widget/dist/auto.global.js" />')}`,
      );
    }
  }

  // Step 4: Set up environment variables (cloud mode only)
  if (ctx.mode === "cloud") {
    const envFilename = getEnvFilename(true);
    const envPath = ensureEnvFile(ctx.installDir, true);

    if (ctx.apiKey) {
      setEnvVariable(envPath, "TCC_API_KEY", ctx.apiKey);
    } else {
      setEnvVariable(envPath, "TCC_API_KEY", "");
    }

    ensureGitignore(ctx.installDir, envFilename);
    p.log.success(`Added ${pc.cyan("TCC_API_KEY")} to ${pc.cyan(envFilename)}`);
  }

  // Step 5: Show next steps
  p.note(
    getNextSteps(ctx),
    "Next steps",
  );
}

function getNextSteps(ctx: WizardContext): string {
  const runCmd = getRunDevCommand(ctx.packageManager);
  const lines: string[] = [];

  lines.push(
    `${pc.bold("1.")} Add ${pc.cyan("experimental_telemetry: { isEnabled: true }")} to your AI SDK calls`,
  );
  lines.push(
    `   (e.g., in generateText or streamText)`,
  );

  if (ctx.mode === "local") {
    lines.push("");
    lines.push(
      `${pc.bold("2.")} Start your dev server: ${pc.cyan(runCmd)}`,
    );
    lines.push(
      `${pc.bold("3.")} Open your app — you'll see the TCC widget in the corner`,
    );
    lines.push("");
    lines.push(
      `${pc.dim("Docs:")} ${pc.underline("https://docs.thecontext.company/frameworks/ai-sdk/local")}`,
    );
  } else {
    lines.push("");
    if (!ctx.apiKey) {
      lines.push(
        `${pc.bold("2.")} Add your TCC API key to ${pc.cyan(".env.local")}`,
      );
      lines.push(
        `   Get one at ${pc.underline("https://app.thecontext.company")}`,
      );
      lines.push("");
      lines.push(`${pc.bold("3.")} Start your dev server: ${pc.cyan(runCmd)}`);
    } else {
      lines.push(`${pc.bold("2.")} Start your dev server: ${pc.cyan(runCmd)}`);
    }
    lines.push("");
    lines.push(
      `${pc.dim("Docs:")} ${pc.underline("https://docs.thecontext.company/frameworks/ai-sdk/setup")}`,
    );
  }

  return lines.join("\n");
}

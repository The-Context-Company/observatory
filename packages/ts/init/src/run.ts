import * as p from "@clack/prompts";
import pc from "picocolors";
import type { Framework, Mode, WizardContext } from "./types.js";
import { FRAMEWORKS } from "./types.js";
import { detectPackageManager } from "./utils/package-manager.js";
import {
  detectFramework,
  detectTypeScript,
  detectSrcDir,
  detectAppRouter,
} from "./utils/framework-detection.js";
import { readPackageJson } from "./utils/file-utils.js";
import { setup as setupNextjsAisdk } from "./frameworks/nextjs-aisdk.js";
import { setup as setupClaudeAgentSdk } from "./frameworks/claude-agent-sdk.js";
import { setup as setupLangchainTs } from "./frameworks/langchain-ts.js";
import { setup as setupMastra } from "./frameworks/mastra.js";
import { setup as setupCustomTs } from "./frameworks/custom-ts.js";

function isCancel(value: unknown): value is symbol {
  return p.isCancel(value);
}

export async function run(): Promise<void> {
  const installDir = process.cwd();

  p.intro(
    `${pc.bgCyan(pc.black(" The Context Company "))} ${pc.dim("— Setup Wizard")}`,
  );

  // ── Check for package.json ──────────────────────────────────────────

  const pkg = readPackageJson(installDir);
  if (!pkg) {
    p.log.error(
      "No package.json found in the current directory.\nMake sure to run this command from the root of your project.",
    );
    p.outro(pc.red("Setup cancelled."));
    process.exit(1);
  }

  // ── Select framework ─────────────────────────────────────────────────

  const detected = detectFramework(installDir);
  const framework = await askForFramework(detected);

  // ── Detect project properties ───────────────────────────────────────

  const typescript = detectTypeScript(installDir);
  const srcDir = detectSrcDir(installDir);
  const appDir = detectAppRouter(installDir);

  // ── Ask for mode (only for frameworks that support local) ───────────

  const frameworkInfo = FRAMEWORKS.find((f) => f.id === framework)!;
  let mode: Mode = "cloud";

  if (frameworkInfo.supportsLocalMode) {
    const modeChoice = await p.select({
      message: "Which mode would you like to use?",
      options: [
        {
          value: "local" as const,
          label: "Local mode",
          hint: "100% local, no account needed — great for getting started",
        },
        {
          value: "cloud" as const,
          label: "Cloud mode",
          hint: "Send traces to The Context Company dashboard",
        },
      ],
    });

    if (isCancel(modeChoice)) {
      p.outro(pc.red("Setup cancelled."));
      process.exit(0);
    }

    mode = modeChoice;
  }

  // ── Ask for API key (cloud mode only) ───────────────────────────────

  let apiKey: string | undefined;

  if (mode === "cloud") {
    const keyInput = await p.text({
      message: "Enter your TCC API key (or press Enter to skip):",
      placeholder: "tcc_...",
      validate: (value) => {
        if (value && value.length > 0 && value.length < 5) {
          return "API key seems too short. Please enter a valid key or leave empty.";
        }
      },
    });

    if (isCancel(keyInput)) {
      p.outro(pc.red("Setup cancelled."));
      process.exit(0);
    }

    if (keyInput && keyInput.trim().length > 0) {
      apiKey = keyInput.trim();
    }
  }

  // ── Detect package manager ──────────────────────────────────────────

  const packageManager = detectPackageManager(installDir);
  p.log.info(`Using ${pc.bold(packageManager)}`);

  // ── Build context ───────────────────────────────────────────────────

  const ctx: WizardContext = {
    framework,
    packageManager,
    mode,
    apiKey,
    installDir,
    typescript,
    srcDir,
    appDir,
  };

  // ── Run framework-specific setup ────────────────────────────────────

  switch (framework) {
    case "nextjs-aisdk":
      await setupNextjsAisdk(ctx);
      break;
    case "claude-agent-sdk":
      await setupClaudeAgentSdk(ctx);
      break;
    case "langchain-ts":
      await setupLangchainTs(ctx);
      break;
    case "mastra":
      await setupMastra(ctx);
      break;
    case "custom-ts":
      await setupCustomTs(ctx);
      break;
  }

  // ── Done ────────────────────────────────────────────────────────────

  p.outro(
    `${pc.green("You're all set!")} ${pc.dim("Happy building! 🎉")}`,
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────

async function askForFramework(
  detected: Framework | null,
): Promise<Framework> {
  const choice = await p.select({
    message: "Which framework are you using?",
    initialValue: detected ?? undefined,
    options: FRAMEWORKS.map((f) => ({
      value: f.id,
      label: f.name,
      hint:
        f.id === detected
          ? `${f.description} ${pc.green("(detected)")}`
          : f.description,
    })),
  });

  if (isCancel(choice)) {
    p.outro(pc.red("Setup cancelled."));
    process.exit(0);
  }

  return choice;
}

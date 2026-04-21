import { createRequire } from "node:module";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { runPipeline } from "./pipeline.js";
import { authStep } from "./steps/auth.js";
import { detectFrameworkStep } from "./steps/detect-framework.js";
import { instrumentStep } from "./steps/instrument.js";
import { provisionKeysStep } from "./steps/provision-keys.js";
import { setupMcpStep } from "./steps/setup-mcp.js";
import { setupSlackStep } from "./steps/setup-slack.js";
import { successSummaryStep } from "./steps/success-summary.js";
import type { Step, WizardContext } from "./types.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

/**
 * Print the liftoff banner: the three Context Company chevrons
 * (blue / yellow-split / red) next to TCC in ANSI-shadow block letters,
 * with the company name as a subtitle. Rendered before the wizard so
 * the terminal has a distinct brand frame on launch.
 */
function printBanner(): void {
  const solid = ["██    ", "  ██  ", "    ██", "  ██  ", "██    ", "      "];
  const split = ["██    ", "  ██  ", "      ", "  ██  ", "██    ", "      "];
  const gap = "  ";

  const tcc = [
    "████████╗ ██████╗ ██████╗",
    "╚══██╔══╝██╔════╝██╔════╝",
    "   ██║   ██║     ██║     ",
    "   ██║   ██║     ██║     ",
    "   ██║   ╚██████╗╚██████╗",
    "   ╚═╝    ╚═════╝ ╚═════╝",
  ];

  console.log();
  for (let i = 0; i < tcc.length; i++) {
    const chev =
      pc.blue(solid[i]) + gap + pc.yellow(split[i]) + gap + pc.red(solid[i]);
    console.log("  " + chev + "   " + pc.bold(tcc[i]));
  }
  console.log();
  console.log("  " + pc.bold("The Context Company"));
  console.log("  " + pc.dim("liftoff · Monitoring for AI Agents"));
  console.log();
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
${pc.bold("@contextcompany/liftoff")} — Monitoring for AI Agents

${pc.dim("Usage:")}
  npx @contextcompany/liftoff

${pc.dim("Options:")}
  --help, -h    Show this help message
  --version     Show version number
`);
    process.exit(0);
  }

  if (args.includes("--version")) {
    console.log(pkg.version);
    process.exit(0);
  }

  printBanner();

  const ctx: WizardContext = {
    installDir: process.cwd(),
    mode: "cloud",
    completedSteps: [],
  };

  // Pipeline: sign in → provision prod key → pick framework → hand off
  // the agent prompt → optionally wire MCP (mints readonly key only if
  // the user opts in) → optionally wire Slack → summary.
  const steps: Step[] = [
    authStep,
    provisionKeysStep,
    detectFrameworkStep,
    instrumentStep,
    setupMcpStep,
    setupSlackStep,
    successSummaryStep,
  ];

  const success = await runPipeline(steps, ctx);
  if (!success) {
    process.exit(1);
  }

  p.outro(`${pc.green("You're all set!")} ${pc.dim("Happy building!")}`);
}

main().catch((err) => {
  console.error("[TCC] Unexpected error:", err);
  process.exit(1);
});

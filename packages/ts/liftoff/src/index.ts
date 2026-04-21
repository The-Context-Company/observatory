import { createRequire } from "node:module";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { runPipeline } from "./pipeline.js";
import { authStep } from "./steps/auth.js";
import { gitCheckStep } from "./steps/git-check.js";
import { installPackagesStep } from "./steps/install-packages.js";
import { instrumentStep } from "./steps/instrument.js";
import { placeholderSteps } from "./steps/placeholder.js";
import { provisionKeysStep } from "./steps/provision-keys.js";
import type { Step, WizardContext } from "./types.js";
import { setApiBase } from "./utils/config.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

/**
 * Truecolor (24-bit) ANSI wrapper. Lets us emit the exact brand hex
 * for each chevron instead of the terminal-theme-dependent
 * picocolors ANSI-8 variant. Every modern terminal (iTerm2, Warp,
 * Terminal.app, VS Code, Alacritty, Kitty, Ghostty, WezTerm) renders
 * these faithfully.
 */
function rgb(r: number, g: number, b: number, text: string): string {
  return `\x1b[38;2;${r};${g};${b}m${text}\x1b[39m`;
}

// TCC brand chevron hexes, tuned against the logo PNG.
const CHEV_BLUE = (t: string) => rgb(30, 143, 230, t); //  #1E8FE6
const CHEV_YELLOW = (t: string) => rgb(255, 197, 39, t); // #FFC527
const CHEV_RED = (t: string) => rgb(241, 57, 92, t); //   #F1395C

/**
 * Print the liftoff banner: the three Context Company chevrons
 * (blue / yellow-split / red) next to TCC in ANSI-shadow block
 * letters, with the company name as a subtitle. Rendered before the
 * wizard so the terminal has a distinct brand frame on launch.
 */
function printBanner(): void {
  // Each chevron is 5 rows of 4-wide block pixels (up from 2-wide
  // before — gives the diagonals more visual weight without looking
  // cartoonish). Trailing empty row aligns the chevron baseline with
  // the 6-row TCC block. Middle chevron has a hollow apex — mirrors
  // the split/dashed middle chevron in the actual logo.
  const solid = [
    "████    ",
    "  ████  ",
    "    ████",
    "  ████  ",
    "████    ",
    "        ",
  ];
  const split = [
    "████    ",
    "  ████  ",
    "        ",
    "  ████  ",
    "████    ",
    "        ",
  ];
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
      CHEV_BLUE(solid[i]) +
      gap +
      CHEV_YELLOW(split[i]) +
      gap +
      CHEV_RED(solid[i]);
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
  npx @contextcompany/liftoff [options]

${pc.dim("Options:")}
  --api-base <url>  TCC API base URL (default: https://api.thecontext.company)
  --help, -h        Show this help message
  --version         Show version number
`);
    process.exit(0);
  }

  if (args.includes("--version")) {
    console.log(pkg.version);
    process.exit(0);
  }

  // Parse --api-base (both `--api-base <url>` and `--api-base=<url>` forms).
  // One flag drives every TCC endpoint the wizard touches, plus the MCP URL
  // baked into editor configs. See src/utils/config.ts for the resolver.
  const apiBaseIdx = args.indexOf("--api-base");
  const apiBaseFromEqual = args
    .find((a) => a.startsWith("--api-base="))
    ?.slice("--api-base=".length);
  const apiBaseArg =
    apiBaseFromEqual ?? (apiBaseIdx !== -1 ? args[apiBaseIdx + 1] : undefined);
  setApiBase(apiBaseArg);

  printBanner();

  const ctx: WizardContext = {
    installDir: process.cwd(),
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

  // Outro
  p.outro(
    `${pc.green("You're all set!")} ${pc.dim("Happy building!")}`,
  );
}

/**
 * Assemble the ordered list of pipeline steps.
 * Each phase adds its steps here as they are implemented.
 */
async function getSteps(): Promise<Step[]> {
  return [gitCheckStep, authStep, provisionKeysStep, ...placeholderSteps];
}

main().catch((err) => {
  console.error("[TCC] Unexpected error:", err);
  process.exit(1);
});

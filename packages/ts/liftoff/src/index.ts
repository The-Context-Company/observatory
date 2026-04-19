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

/**
 * Print the liftoff banner: the three Context Company chevrons
 * (blue / yellow-split / red) next to LIFTOFF in ANSI-shadow block
 * letters, with the company name as a subtitle. Rendered before the
 * clack intro so the terminal has a distinct brand frame on launch.
 */
function printBanner(): void {
  // Each chevron is 5 rows tall, 6 chars wide. The middle (yellow)
  // chevron has its apex hollowed out — matching the split/dashed
  // middle chevron in the Context Company logo.
  const solid = ["██    ", "  ██  ", "    ██", "  ██  ", "██    "];
  const split = ["██    ", "  ██  ", "      ", "  ██  ", "██    "];
  const gap = "  ";

  const liftoff = [
    "██╗     ██╗███████╗████████╗ ██████╗ ███████╗███████╗",
    "██║     ██║██╔════╝╚══██╔══╝██╔═══██╗██╔════╝██╔════╝",
    "██║     ██║█████╗     ██║   ██║   ██║█████╗  █████╗  ",
    "██║     ██║██╔══╝     ██║   ██║   ██║██╔══╝  ██╔══╝  ",
    "███████╗██║██║        ██║   ╚██████╔╝██║     ██║     ",
    "╚══════╝╚═╝╚═╝        ╚═╝    ╚═════╝ ╚═╝     ╚═╝     ",
  ];

  // Chevron row visual width: 6 + 2 + 6 + 2 + 6 = 22 cols
  const chevronBlock = " ".repeat(22);

  console.log();
  // Rows 0-4: chevrons side-by-side with the LIFTOFF block, right-aligned vertically
  for (let i = 0; i < liftoff.length; i++) {
    const chev =
      i < solid.length
        ? pc.blue(solid[i]) + gap + pc.yellow(split[i]) + gap + pc.red(solid[i])
        : chevronBlock;
    console.log("  " + chev + "   " + pc.bold(liftoff[i]));
  }
  console.log();
  console.log(
    "  " +
      pc.bold("The Context Company") +
      pc.dim(" · AI observability in 2 minutes"),
  );
  console.log();
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Handle --help
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
${pc.bold("@contextcompany/liftoff")} — AI agent observability setup

${pc.dim("Usage:")}
  npx @contextcompany/liftoff [options]

${pc.dim("Options:")}
  --key <key>   Use existing API key (skips auth, MCP, and Slack setup)
  --help, -h    Show this help message
  --version     Show version number
`);
    process.exit(0);
  }

  // Handle --version
  if (args.includes("--version")) {
    console.log("0.1.0");
    process.exit(0);
  }

  // Parse --key flag
  const keyIndex = args.indexOf("--key");
  const providedKey =
    keyIndex !== -1 && args[keyIndex + 1]
      ? args[keyIndex + 1]
      : undefined;

  // Show banner + intro
  printBanner();
  p.intro(pc.dim("Setup wizard"));

  // Initialize context
  const ctx: WizardContext = {
    installDir: process.cwd(),
    mode: "cloud",
    completedSteps: [],
    keyProvided: !!providedKey,
    apiKey: providedKey,
  };

  if (providedKey) {
    p.log.warn(
      "Using provided API key. MCP and Slack setup will be skipped (no user identity).",
    );
  }

  // Assemble pipeline steps
  // Steps are added by subsequent phases:
  // Phase 1: git-check (Plan 03)
  // Phase 2: auth, key-provisioning
  // Phase 3: detection, package-install
  // Phase 4: instrumentation
  // Phase 5: mcp-setup
  // Phase 6: slack-setup ✓
  // Phase 7: success-summary (done)
  const steps: Step[] = await getSteps();

  // Run pipeline
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

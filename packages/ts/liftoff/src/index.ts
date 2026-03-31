import * as p from "@clack/prompts";
import pc from "picocolors";
import { runPipeline } from "./pipeline.js";
import type { Step, WizardContext } from "./types.js";

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

  // Show intro
  p.intro(
    `${pc.bgCyan(pc.black(" @contextcompany/liftoff "))} ${pc.dim("— AI observability setup")}`,
  );

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
  // Phase 6: slack-setup
  // Phase 7: success-summary
  const steps: Step[] = await getSteps();

  // Run pipeline
  await runPipeline(steps, ctx);

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
  // Import steps as they are created in subsequent plans/phases
  // For now, return an empty array -- Plan 03 adds git-check
  return [];
}

main().catch((err) => {
  console.error("[TCC] Unexpected error:", err);
  process.exit(1);
});

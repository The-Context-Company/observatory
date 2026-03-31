import * as p from "@clack/prompts";
import pc from "picocolors";
import type { Step, WizardContext } from "./types.js";

/**
 * Cleanup functions registered by steps, called in reverse on exit.
 * Exported for testing; not part of public API.
 * @internal
 */
export const cleanupStack: Array<() => Promise<void>> = [];

let isCleaningUp = false;

async function runCleanup(): Promise<void> {
  if (isCleaningUp) return;
  isCleaningUp = true;
  for (const cleanup of cleanupStack.reverse()) {
    try {
      await cleanup();
    } catch {
      // Best-effort cleanup -- don't let one failure block others
    }
  }
  cleanupStack.length = 0;
}

function setupSignalHandlers(ctx: WizardContext, steps: Step[]): void {
  const handler = async () => {
    p.cancel("Setup cancelled.");
    // Run step-specific cleanups for steps that have run
    for (const stepName of [...ctx.completedSteps].reverse()) {
      const step = steps.find((s) => s.name === stepName);
      if (step?.cleanup) {
        try {
          await step.cleanup(ctx);
        } catch {
          // Best-effort
        }
      }
    }
    await runCleanup();
    process.exit(0);
  };

  process.on("SIGINT", handler);
  process.on("SIGTERM", handler);
}

/**
 * Run a sequence of pipeline steps with shared context.
 * Steps are executed in order. Each step's shouldRun() is checked
 * first for idempotency -- if false, the step is skipped.
 */
export async function runPipeline(
  steps: Step[],
  ctx: WizardContext,
): Promise<void> {
  setupSignalHandlers(ctx, steps);

  for (const step of steps) {
    const shouldRun = await step.shouldRun(ctx);
    if (!shouldRun) {
      p.log.info(pc.dim(`Skipping ${step.name} (already done)`));
      continue;
    }

    const result = await step.run(ctx);

    switch (result.status) {
      case "completed":
        ctx.completedSteps.push(step.name);
        break;
      case "skipped":
        p.log.info(
          pc.dim(`${step.name}: ${result.message ?? "skipped"}`),
        );
        break;
      case "failed":
        p.log.error(
          `${step.name} failed${result.message ? `: ${result.message}` : ""}`,
        );
        await runCleanup();
        return;
    }
  }
}

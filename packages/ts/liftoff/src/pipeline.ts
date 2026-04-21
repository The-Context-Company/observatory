import * as p from "@clack/prompts";
import pc from "picocolors";
import type { Step, WizardContext } from "./types.js";

function setupSignalHandlers(
  ctx: WizardContext,
  steps: Step[],
  getCurrentStep: () => Step | null
): void {
  const handler = async () => {
    p.cancel("Setup cancelled.");
    // Clean up the currently running step first (if any)
    const currentStep = getCurrentStep();
    if (currentStep?.cleanup) {
      try {
        await currentStep.cleanup(ctx);
      } catch {
        // Best-effort
      }
    }
    // Run step-specific cleanups for steps that have completed
    for (const stepName of [...ctx.completedSteps].reverse()) {
      const step = steps.find((s) => s.name === stepName);
      if (step?.cleanup && step !== currentStep) {
        try {
          await step.cleanup(ctx);
        } catch {
          // Best-effort
        }
      }
    }
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
  ctx: WizardContext
): Promise<boolean> {
  let currentStep: Step | null = null;
  setupSignalHandlers(ctx, steps, () => currentStep);

  for (const step of steps) {
    const shouldRun = await step.shouldRun(ctx);
    if (!shouldRun) {
      p.log.info(pc.dim(`Skipping ${step.name} (already done)`));
      continue;
    }

    currentStep = step;
    const result = await step.run(ctx);
    currentStep = null;

    switch (result.status) {
      case "completed":
        ctx.completedSteps.push(step.name);
        break;
      case "skipped":
        p.log.info(pc.dim(`${step.name}: ${result.message ?? "skipped"}`));
        break;
      case "failed":
        p.log.error(
          `${step.name} failed${result.message ? `: ${result.message}` : ""}`
        );
        return false;
    }
  }

  return true;
}

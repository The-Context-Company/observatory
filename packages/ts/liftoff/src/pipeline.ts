import * as p from "@clack/prompts";
import pc from "picocolors";
import type { Step, WizardContext } from "./types.js";

/**
 * Track the step currently inside .run() so a signal handler can
 * cleanup it in addition to any already-completed steps. Nothing
 * else should touch this — it's pipeline internals.
 */
let runningStep: Step | null = null;

function setupSignalHandlers(ctx: WizardContext, steps: Step[]): void {
  let handled = false;
  const handler = async () => {
    if (handled) return;
    handled = true;
    p.cancel("Setup cancelled.");

    // Cleanup the running step first (it owns live resources like
    // the localhost OAuth server), then walk completedSteps in
    // reverse order. Skip the running step if it happens to also be
    // in completedSteps (shouldn't, but belt-and-suspenders).
    const seen = new Set<string>();
    const queue: Step[] = [];
    if (runningStep) {
      queue.push(runningStep);
      seen.add(runningStep.name);
    }
    for (const name of [...ctx.completedSteps].reverse()) {
      if (seen.has(name)) continue;
      const s = steps.find((x) => x.name === name);
      if (s) {
        queue.push(s);
        seen.add(name);
      }
    }

    for (const step of queue) {
      if (!step.cleanup) continue;
      try {
        await step.cleanup(ctx);
      } catch {
        // Best-effort — don't let one cleanup failure block the rest.
      }
    }
    // Unix convention for SIGINT termination is 128 + signal number.
    // Exiting 0 would let CI treat a Ctrl+C cancel as success; that's
    // also inconsistent with the pipeline-failure path which exits 1.
    process.exit(130);
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
): Promise<boolean> {
  setupSignalHandlers(ctx, steps);

  for (const step of steps) {
    const shouldRun = await step.shouldRun(ctx);
    if (!shouldRun) {
      p.log.info(pc.dim(`Skipping ${step.name} (already done)`));
      continue;
    }

    runningStep = step;
    let result;
    try {
      result = await step.run(ctx);
    } finally {
      runningStep = null;
    }

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
        return false;
    }
  }

  return true;
}

import * as p from "@clack/prompts";
import pc from "picocolors";
import { FRAMEWORKS, type Framework, type Step, type StepResult, type WizardContext } from "../types.js";
import { detectFramework } from "../utils/framework-detection.js";
import { detectPackageManager } from "../utils/package-manager.js";

/**
 * Pipeline step: detect the user's framework and package manager.
 *
 * Auto-detects the framework from project files and presents
 * it to the user for confirmation via an interactive select prompt.
 * If no framework is detected, the user picks manually from the list.
 */
export const detectFrameworkStep: Step = {
  name: "detect-framework",

  async shouldRun(ctx: WizardContext): Promise<boolean> {
    // Skip if framework is already set (idempotency)
    return !ctx.framework;
  },

  async run(ctx: WizardContext): Promise<StepResult> {
    // Auto-detect framework from project files
    const detected = detectFramework(ctx.installDir);

    // Build options from FRAMEWORKS array
    const options = FRAMEWORKS.map((f) => ({
      value: f.id as Framework,
      label: f.name,
      hint:
        f.id === detected
          ? pc.green("(detected)") + " " + f.description
          : f.description,
    }));

    // Present framework selection
    const choice = await p.select({
      message: "Which framework are you using?",
      options,
      initialValue: detected ?? undefined,
    });

    if (p.isCancel(choice)) {
      return { status: "failed", message: "User cancelled" };
    }

    ctx.framework = choice;

    // Detect package manager
    ctx.packageManager = detectPackageManager(ctx.installDir);

    const frameworkName =
      FRAMEWORKS.find((f) => f.id === ctx.framework)?.name ?? ctx.framework;

    p.log.success(
      `Framework: ${pc.bold(frameworkName)}, Package manager: ${pc.bold(ctx.packageManager)}`,
    );

    return { status: "completed" };
  },
};

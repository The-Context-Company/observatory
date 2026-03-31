import type { Step, StepResult, WizardContext } from "../types.js";

function createPlaceholderStep(name: string, description: string): Step {
  return {
    name,

    async shouldRun(_ctx: WizardContext): Promise<boolean> {
      // Placeholder steps never run -- they exist to show the pipeline structure
      return false;
    },

    async run(_ctx: WizardContext): Promise<StepResult> {
      return { status: "skipped", message: `${description} (coming soon)` };
    },
  };
}

/**
 * Placeholder steps for future phases.
 * As each phase is implemented, its placeholder is replaced with a real step import.
 * Remaining: authenticate and provision-keys (auth phase).
 */
export const placeholderSteps: Step[] = [
  createPlaceholderStep(
    "detect-framework",
    "Framework and package manager detection",
  ),
  createPlaceholderStep("install-packages", "SDK package installation"),
  createPlaceholderStep("instrument", "Codebase instrumentation"),
  createPlaceholderStep("setup-mcp", "MCP editor integration"),
  createPlaceholderStep("setup-slack", "Slack alerts connection"),
  createPlaceholderStep("success-summary", "Setup summary and next steps"),
];

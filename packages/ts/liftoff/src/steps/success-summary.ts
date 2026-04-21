import * as p from "@clack/prompts";
import pc from "picocolors";
import { FRAMEWORKS, type Step, type StepResult, type WizardContext } from "../types.js";
import { getDashboardUrl } from "../utils/config.js";
import { getRunDevCommand } from "../utils/package-manager.js";

/**
 * Pipeline step: display a success summary and next steps.
 *
 * Prints a receipt-style summary of everything the wizard did:
 * - Framework detected
 * - Files created/modified
 * - Metadata hooks wired
 * - MCP editors configured
 * - Slack connection status
 * - Exact command to run the app
 * - Deep-link to the dashboard
 */
export const successSummaryStep: Step = {
  name: "success-summary",

  async shouldRun(ctx: WizardContext): Promise<boolean> {
    return !ctx.completedSteps.includes("success-summary");
  },

  async run(ctx: WizardContext): Promise<StepResult> {
    const lines: string[] = [];

    // Framework (SUM-01)
    const frameworkInfo = FRAMEWORKS.find(
      (f) => f.id === ctx.framework,
    );
    const frameworkName = frameworkInfo?.name ?? ctx.framework ?? "Unknown";
    lines.push(
      `${pc.dim("Framework")}    ${frameworkName}`,
    );

    // Instrumentation handoff status — liftoff now hands a prompt
    // to the user's coding agent rather than writing files itself.
    lines.push(
      `${pc.dim("Instrument")}   ${pc.dim("Prompt copied — paste into your AI coding agent")}`,
    );

    // MCP editors (SUM-04)
    if (
      ctx.editorsConfigured &&
      ctx.editorsConfigured.length > 0
    ) {
      lines.push(
        `${pc.dim("MCP")}          ${ctx.editorsConfigured.join(", ")}`,
      );
    } else {
      lines.push(
        `${pc.dim("MCP")}          ${pc.dim("Not configured")}`,
      );
    }

    // Slack status (SUM-05)
    if (ctx.slackConnected) {
      lines.push(
        `${pc.dim("Slack")}        ${pc.green("Connected")}`,
      );
    } else {
      lines.push(
        `${pc.dim("Slack")}        ${pc.dim("Skipped")}`,
      );
    }

    // Print the summary box
    p.note(lines.join("\n"), "Setup Complete");

    // Next steps (WIN-01, WIN-03, SUM-06)
    const pm = ctx.packageManager ?? "npm";
    const runCmd = getRunDevCommand(pm);

    p.log.step(
      `${pc.bold("Next:")} paste the prompt (already on your clipboard) into your AI coding agent.\n` +
        `${pc.dim("The agent installs the SDK, writes instrumentation, and wires metadata against your codebase.")}\n\n` +
        `When it finishes, run your app:\n\n` +
        `  ${pc.cyan(pc.bold(runCmd))}\n\n` +
        `${pc.dim("Traces will start flowing to the dashboard:")}\n` +
        `  ${pc.underline(`${getDashboardUrl()}/prod/runs`)}`,
    );

    ctx.completedSteps.push("success-summary");
    return { status: "completed" };
  },
};

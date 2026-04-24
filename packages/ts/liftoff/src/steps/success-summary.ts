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

    // Instrumentation handoff status — liftoff hands a prompt to the
    // user's coding agent rather than writing files itself. Branch on
    // whether the instrument step actually copied the prompt (it can
    // be skipped: fetch fail, user decline, clipboard unavailable).
    lines.push(
      `${pc.dim("Instrument")}   ${
        ctx.promptCopied
          ? pc.dim("Prompt copied — paste into your AI coding agent")
          : pc.dim("Not copied — see docs URL above for manual setup")
      }`,
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

    // Next steps. If the prompt was copied, the user has already
    // pasted it (we gated on that in the instrument step) — so we
    // don't re-tell them to paste. We just tell them what happens
    // next: agent instruments, they run the app, check the dashboard,
    // and fall back to the TCC_API_KEY hint if runs don't appear.
    const pm = ctx.packageManager ?? "npm";
    const runCmd = getRunDevCommand(pm);
    const dashUrl = `${getDashboardUrl()}/prod/runs`;

    if (ctx.promptCopied) {
      p.log.step(
        `${pc.bold("Your coding agent will now instrument your codebase.")} It may ask you a few questions along the way — answer them so it can wire things up correctly.\n\n` +
          `When it's done, run your app:\n\n` +
          `  ${pc.cyan(pc.bold(runCmd))}\n\n` +
          `Then check the dashboard to see your runs flowing in:\n` +
          `  ${pc.underline(dashUrl)}\n\n` +
          `${pc.dim("If nothing shows up, make sure TCC_API_KEY is set in your environment variables.")}`,
      );
    } else {
      p.log.step(
        `${pc.bold("Next:")} grab the instrumentation prompt from the docs and paste it into your AI coding agent.\n` +
          `${pc.dim("The agent installs the SDK, writes instrumentation, and wires metadata against your codebase.")}\n\n` +
          `When it finishes, run your app:\n\n` +
          `  ${pc.cyan(pc.bold(runCmd))}\n\n` +
          `${pc.dim("Runs will start flowing to the dashboard:")}\n` +
          `  ${pc.underline(dashUrl)}`,
      );
    }

    // Pipeline pushes step.name on "completed" — don't push again.
    return { status: "completed" };
  },
};

import * as p from "@clack/prompts";
import pc from "picocolors";
import { FRAMEWORKS, type Step, type StepResult, type WizardContext } from "../types.js";
import { getDashboardUrl } from "../utils/config.js";
import { getRunDevCommand } from "../utils/package-manager.js";

export const successSummaryStep: Step = {
  name: "success-summary",

  async shouldRun(ctx: WizardContext): Promise<boolean> {
    return !ctx.completedSteps.includes("success-summary");
  },

  async run(ctx: WizardContext): Promise<StepResult> {
    const lines: string[] = [];

    const frameworkInfo = FRAMEWORKS.find(
      (f) => f.id === ctx.framework,
    );
    const frameworkName = frameworkInfo?.name ?? ctx.framework ?? "Unknown";
    lines.push(
      `${pc.dim("Framework")}    ${frameworkName}`,
    );

    if (ctx.apiKey) {
      lines.push(`${pc.dim("API key")}      ${pc.green("Provisioned")}`);
    } else {
      lines.push(`${pc.dim("API key")}      ${pc.yellow("Generate at dashboard")}`);
    }

    lines.push(
      `${pc.dim("Instrument")}   ${
        ctx.promptCopied
          ? pc.dim("Prompt copied — paste into your AI coding agent")
          : pc.dim("Not copied — see docs URL above for manual setup")
      }`,
    );

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

    if (ctx.slackOpened) {
      lines.push(
        `${pc.dim("Slack")}        ${pc.yellow("Finish in browser")}`,
      );
    } else {
      lines.push(
        `${pc.dim("Slack")}        ${pc.dim("Skipped")}`,
      );
    }

    p.note(lines.join("\n"), "Setup Complete");

    // If the prompt was copied, the user has already pasted it (the
    // instrument step gates on that), so don't re-tell them to paste.
    const pm = ctx.packageManager ?? "npm";
    const runCmd = getRunDevCommand(pm);
    const dashUrl = `${getDashboardUrl()}/prod/runs`;
    const settingsUrl = `${getDashboardUrl()}/prod/settings`;

    const apiKeyPreamble = ctx.apiKey
      ? ""
      : ctx.accessToken
        ? `${pc.bold("First, grab your API key.")} We couldn't provision one automatically. Generate one in the dashboard and add it to your environment as ${pc.bold("TCC_API_KEY")}:\n  ${pc.underline(settingsUrl)}\n\n`
        : `${pc.bold("First, grab your API key.")} You skipped sign-in, so we couldn't provision one for you. Generate one in the dashboard and add it to your environment as ${pc.bold("TCC_API_KEY")}:\n  ${pc.underline(settingsUrl)}\n\n`;

    if (ctx.promptCopied) {
      p.log.step(
        apiKeyPreamble +
          `${pc.bold("Your coding agent will now instrument your codebase.")} It may ask you a few questions along the way — answer them so it can wire things up correctly.\n\n` +
          `When it's done, run your app:\n\n` +
          `  ${pc.cyan(pc.bold(runCmd))}\n\n` +
          `Then check the dashboard to see your runs flowing in:\n` +
          `  ${pc.underline(dashUrl)}\n\n` +
          `${pc.dim("If nothing shows up, make sure TCC_API_KEY is set in your environment variables.")}`,
      );
    } else {
      p.log.step(
        apiKeyPreamble +
          `${pc.bold("Next:")} grab the instrumentation prompt from the docs and paste it into your AI coding agent.\n` +
          `${pc.dim("The agent installs the SDK, writes instrumentation, and wires metadata against your codebase.")}\n\n` +
          `When it finishes, run your app:\n\n` +
          `  ${pc.cyan(pc.bold(runCmd))}\n\n` +
          `${pc.dim("Runs will start flowing to the dashboard:")}\n` +
          `  ${pc.underline(dashUrl)}`,
      );
    }

    return { status: "completed" };
  },
};

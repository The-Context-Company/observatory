import * as p from "@clack/prompts";
import pc from "picocolors";
import { FRAMEWORKS, type Step, type StepResult, type WizardContext } from "../types.js";
import { getRunDevCommand } from "../utils/package-manager.js";

const DASHBOARD_URL = "https://www.thecontext.company/prod/runs";

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

    // Files created/modified (SUM-02)
    const hasCreated = ctx.filesCreated && ctx.filesCreated.length > 0;
    const hasModified =
      ctx.filesModified && ctx.filesModified.length > 0;

    if (hasCreated || hasModified) {
      const fileLines: string[] = [];
      if (hasCreated) {
        for (const f of ctx.filesCreated!) {
          fileLines.push(
            `             ${pc.green("+")} ${f}`,
          );
        }
      }
      if (hasModified) {
        for (const f of ctx.filesModified!) {
          fileLines.push(
            `             ${pc.yellow("~")} ${f}`,
          );
        }
      }
      lines.push(`${pc.dim("Files")}        ${fileLines[0]?.trim()}`);
      for (let i = 1; i < fileLines.length; i++) {
        lines.push(fileLines[i]);
      }
    } else {
      lines.push(
        `${pc.dim("Files")}        ${pc.dim("No instrumentation files changed")}`,
      );
    }

    // Metadata hooks (SUM-03)
    if (ctx.metadataHooks) {
      const sid = ctx.metadataHooks.sessionId
        ? pc.green("wired")
        : pc.dim("TODO");
      const uid = ctx.metadataHooks.userId
        ? pc.green("wired")
        : pc.dim("TODO");
      const conv = ctx.metadataHooks.conversational
        ? pc.green("wired")
        : pc.dim("TODO");
      lines.push(
        `${pc.dim("Metadata")}     sessionId: ${sid}, userId: ${uid}, conversational: ${conv}`,
      );
    } else {
      lines.push(
        `${pc.dim("Metadata")}     ${pc.dim("Template instrumentation (no AI metadata)")}`,
      );
    }

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
      `${pc.bold("You're instrumented.")} Start your app and traces will begin flowing.\n\n` +
        `  ${pc.cyan(pc.bold(runCmd))}\n\n` +
        `${pc.dim("Then open the dashboard to watch them arrive:")}\n` +
        `  ${pc.underline(DASHBOARD_URL)}`,
    );

    ctx.completedSteps.push("success-summary");
    return { status: "completed" };
  },
};

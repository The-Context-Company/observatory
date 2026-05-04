import * as p from "@clack/prompts";
import pc from "picocolors";
import type { Step, StepResult, WizardContext } from "../types.js";
import {
  type EditorId,
  EDITOR_CONFIGS,
  detectEditors,
  runClaudeMcpAdd,
  writeMcpConfig,
} from "../utils/mcp-config.js";

/**
 * Pipeline step: configure MCP for the user's AI coding editors.
 *
 * The MCP server uses OAuth — editors negotiate auth on first connect
 * via the standard MCP discovery flow, so this step doesn't need an
 * access token or readonly key. It runs even if the user skipped
 * sign-in, since wiring the server URL into editor config is purely
 * client-side.
 */
export const setupMcpStep: Step = {
  name: "setup-mcp",

  async shouldRun(ctx: WizardContext): Promise<boolean> {
    return !ctx.completedSteps.includes("setup-mcp");
  },

  async run(ctx: WizardContext): Promise<StepResult> {
    // Extra gap above the section heading creates breathing room and
    // signals "new chapter". Inside the section we rely on clack's
    // default spacing between log calls and confirms.
    p.log.message("");
    p.log.step(pc.bold("MCP server"));
    p.log.info(
      "Gives your coding agents live dev/prod context so they can find and fix issues from the editor.",
    );

    const wantsMcp = await p.confirm({
      message: "Wire the TCC MCP server into your editors?",
      initialValue: true,
    });

    if (p.isCancel(wantsMcp) || !wantsMcp) {
      return { status: "skipped", message: "MCP setup skipped" };
    }

    const detectedEditors = detectEditors(ctx.installDir);
    const options = (
      Object.entries(EDITOR_CONFIGS) as [
        EditorId,
        (typeof EDITOR_CONFIGS)[EditorId],
      ][]
    ).map(([id, config]) => ({
      value: id,
      label: config.name,
      hint: detectedEditors.includes(id) ? "detected" : undefined,
    }));

    const selected = await p.multiselect({
      message: "Which editors should we configure?",
      options,
      initialValues: detectedEditors,
      required: false,
    });

    if (p.isCancel(selected) || selected.length === 0) {
      return { status: "skipped", message: "MCP setup skipped (no editors)" };
    }

    const configuredEditors: string[] = [];
    for (const editorId of selected) {
      const config = EDITOR_CONFIGS[editorId];
      try {
        if (config.configType === "cli") {
          const result = runClaudeMcpAdd();
          if (!result.success) {
            p.log.warn(
              `Could not configure ${config.name}: ${result.error}`,
            );
            continue;
          }
        } else {
          writeMcpConfig(editorId, ctx.installDir);
        }
        p.log.success(`Configured ${config.name}`);
        configuredEditors.push(config.name);
      } catch (err) {
        p.log.warn(
          `Could not configure ${config.name}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    ctx.editorsConfigured = configuredEditors;
    if (configuredEditors.length > 0) {
      p.log.info(
        pc.dim(
          "Your editor will prompt you to sign in the first time you use a TCC tool.",
        ),
      );
    }
    // Pipeline pushes step.name on "completed" — don't push again.
    return { status: "completed" };
  },
};

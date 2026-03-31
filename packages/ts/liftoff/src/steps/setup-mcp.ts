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
 * Detects installed MCP-capable editors, shows a multiselect with detected
 * editors pre-checked, writes/merges MCP config files (or runs `claude mcp add`
 * for Claude Code), using the readonly key as Bearer token.
 *
 * Skips entirely when:
 * - `--key` mode (no user identity for MCP)
 * - No readonlyKey available in context
 * - Already completed in this session
 */
export const setupMcpStep: Step = {
  name: "setup-mcp",

  async shouldRun(ctx: WizardContext): Promise<boolean> {
    if (ctx.keyProvided) return false;
    if (!ctx.readonlyKey) return false;
    if (ctx.completedSteps.includes("setup-mcp")) return false;
    return true;
  },

  async run(ctx: WizardContext): Promise<StepResult> {
    // Show benefits explanation (MCP-07)
    p.log.info(
      pc.cyan(
        "MCP connects your AI coding tools to production observability.\n",
      ) +
        "Your editor can now query prod runs, find failures, and search insights.",
    );

    // Detect installed editors
    const detectedEditors = detectEditors(ctx.installDir);

    // Build options for all editors
    const options = (
      Object.entries(EDITOR_CONFIGS) as [
        EditorId,
        (typeof EDITOR_CONFIGS)[EditorId],
      ][]
    ).map(([id, config]) => ({
      value: id,
      label: config.name,
      hint: detectedEditors.includes(id)
        ? "detected"
        : undefined,
    }));

    // Show multiselect with detected editors pre-checked (MCP-02)
    const selected = await p.multiselect({
      message: "Which editors should we configure for MCP?",
      options,
      initialValues: detectedEditors,
      required: false,
    });

    // Handle cancel or empty selection
    if (p.isCancel(selected) || selected.length === 0) {
      return { status: "skipped", message: "MCP setup skipped" };
    }

    // Configure each selected editor
    for (const editorId of selected) {
      const config = EDITOR_CONFIGS[editorId];

      if (config.configType === "cli") {
        // Claude Code: use `claude mcp add`
        const result = runClaudeMcpAdd(ctx.readonlyKey!);
        if (result.success) {
          p.log.success(`Configured ${config.name}`);
        } else {
          p.log.warn(
            `Could not configure ${config.name}: ${result.error}`,
          );
        }
      } else {
        // File-based editors: write/merge MCP config
        try {
          writeMcpConfig(editorId, ctx.installDir, ctx.readonlyKey!);
          p.log.success(`Configured ${config.name}`);
        } catch (err) {
          p.log.warn(
            `Could not configure ${config.name}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }

    ctx.completedSteps.push("setup-mcp");
    return { status: "completed" };
  },
};

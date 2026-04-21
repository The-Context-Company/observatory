import * as p from "@clack/prompts";
import pc from "picocolors";
import type { Step, StepResult, WizardContext } from "../types.js";
import { getApiBase } from "../utils/config.js";
import {
  type EditorId,
  EDITOR_CONFIGS,
  detectEditors,
  runClaudeMcpAdd,
  writeMcpConfig,
} from "../utils/mcp-config.js";

/**
 * Provision a readonly MCP key on demand. Called only after the user
 * opts into MCP setup — we don't mint readonly keys the user never
 * asked for.
 */
async function provisionReadonlyKey(
  ctx: WizardContext,
): Promise<string | null> {
  try {
    const response = await fetch(`${getApiBase()}/cli/keys`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ctx.accessToken}`,
      },
      body: JSON.stringify({
        organizationId: ctx.organizationId,
        type: "readonly",
      }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      readonlyKey: { key: string; keyId: string };
    };
    return data.readonlyKey?.key ?? null;
  } catch {
    return null;
  }
}

/**
 * Pipeline step: configure MCP for the user's AI coding editors.
 *
 * Asks the user if they want MCP wired up. If yes, provisions a
 * readonly key on demand (we don't create a key the user didn't ask
 * for), then writes/merges MCP config files for each selected editor.
 */
export const setupMcpStep: Step = {
  name: "setup-mcp",

  async shouldRun(ctx: WizardContext): Promise<boolean> {
    if (ctx.completedSteps.includes("setup-mcp")) return false;
    // Needs an access token so we can mint a readonly key.
    return !!ctx.accessToken;
  },

  async run(ctx: WizardContext): Promise<StepResult> {
    p.log.info(
      "Give your coding agents context about what's happening in dev and\n" +
        "production so they can find and fix issues directly from the editor.",
    );

    const wantsMcp = await p.confirm({
      message: "Wire the TCC MCP server into your editors?",
      initialValue: true,
    });

    if (p.isCancel(wantsMcp) || !wantsMcp) {
      return { status: "skipped", message: "MCP setup skipped" };
    }

    // Detect editors and ask which to configure BEFORE minting the
    // key — if the user has no editors to configure, we skip minting.
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

    // Mint the readonly key now, after we know the user actually wants MCP.
    const spinner = p.spinner();
    spinner.start("Provisioning readonly MCP key...");
    const readonlyKey = await provisionReadonlyKey(ctx);
    if (!readonlyKey) {
      spinner.stop("Readonly key provisioning failed");
      return {
        status: "skipped",
        message: "Could not provision readonly key for MCP",
      };
    }
    ctx.readonlyKey = readonlyKey;
    spinner.stop("Readonly MCP key provisioned");

    const configuredEditors: string[] = [];
    for (const editorId of selected) {
      const config = EDITOR_CONFIGS[editorId];
      try {
        if (config.configType === "cli") {
          const result = runClaudeMcpAdd(readonlyKey);
          if (!result.success) {
            p.log.warn(
              `Could not configure ${config.name}: ${result.error}`,
            );
            continue;
          }
        } else {
          writeMcpConfig(editorId, ctx.installDir, readonlyKey);
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
    ctx.completedSteps.push("setup-mcp");
    return { status: "completed" };
  },
};

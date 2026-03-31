import { randomBytes } from "node:crypto";
import open from "open";
import * as p from "@clack/prompts";
import pc from "picocolors";
import type { Step, StepResult, WizardContext } from "../types.js";
import { startCallbackServer } from "../utils/localhost-server.js";
import {
  type EditorId,
  EDITOR_CONFIGS,
  detectEditors,
  runClaudeMcpAdd,
  writeMcpConfig,
} from "../utils/mcp-config.js";

const API_BASE = "https://api.thecontext.company";
const AUTH_TIMEOUT_MS = 30_000;

/**
 * Run an inline OAuth flow to acquire a readonly key for MCP.
 * Used when --key mode skipped the normal auth step.
 */
async function acquireReadonlyKey(ctx: WizardContext): Promise<boolean> {
  try {
    // 1. Generate CSRF state
    const state = randomBytes(16).toString("hex");

    // 2. Start localhost callback server
    const server = await startCallbackServer(state, AUTH_TIMEOUT_MS);

    // 3. Open browser
    p.log.info("Opening browser for authentication...");
    const url = `${API_BASE}/cli/auth/start?port=${server.port}&state=${state}`;
    await open(url);

    // 4. Wait for callback
    p.log.info(pc.dim("Waiting for authentication... (30s timeout)"));
    const result = await server.waitForCallback();

    if (!result) {
      p.log.warn("Authentication timed out.");
      return false;
    }

    // 5. Exchange code for tokens
    const authResponse = await fetch(`${API_BASE}/cli/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: result.code }),
    });

    if (!authResponse.ok) {
      p.log.warn("Authentication failed.");
      return false;
    }

    const authData = (await authResponse.json()) as {
      accessToken: string;
      user: { id: string; email: string; firstName?: string };
      organizationId: string | null;
    };

    if (!authData.organizationId) {
      p.log.warn("No organization found for key provisioning.");
      return false;
    }

    p.log.success(`Authenticated as ${authData.user.email}`);

    // 6. Provision readonly key only
    const keysResponse = await fetch(`${API_BASE}/cli/keys`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authData.accessToken}`,
      },
      body: JSON.stringify({ organizationId: authData.organizationId }),
    });

    if (!keysResponse.ok) {
      p.log.warn("Key provisioning failed.");
      return false;
    }

    const keysData = (await keysResponse.json()) as {
      prodKey: { key: string; keyId: string };
      readonlyKey: { key: string; keyId: string };
    };

    ctx.readonlyKey = keysData.readonlyKey.key;
    p.log.success("Readonly key provisioned for MCP");

    return true;
  } catch (error) {
    p.log.warn(
      `Authentication failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return false;
  }
}

/**
 * Pipeline step: configure MCP for the user's AI coding editors.
 *
 * Detects installed MCP-capable editors, shows a multiselect with detected
 * editors pre-checked, writes/merges MCP config files (or runs `claude mcp add`
 * for Claude Code), using the readonly key as Bearer token.
 *
 * When readonlyKey is missing (e.g. --key mode), offers inline OAuth to
 * provision one. Skips gracefully if the user declines or auth fails.
 */
export const setupMcpStep: Step = {
  name: "setup-mcp",

  async shouldRun(ctx: WizardContext): Promise<boolean> {
    if (ctx.completedSteps.includes("setup-mcp")) return false;
    return true;
  },

  async run(ctx: WizardContext): Promise<StepResult> {
    // D-07, D-08: --key mode users need a readonly key for MCP
    if (!ctx.readonlyKey) {
      const wantMcp = await p.confirm({
        message:
          "MCP requires a readonly API key. Want to log in now to get one?",
      });

      if (p.isCancel(wantMcp) || !wantMcp) {
        return { status: "skipped", message: "MCP setup skipped (no readonly key)" };
      }

      // D-09: Run inline OAuth flow
      const acquired = await acquireReadonlyKey(ctx);
      if (!acquired) {
        return { status: "skipped", message: "MCP setup skipped (auth failed)" };
      }
    }

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
    const configuredEditors: string[] = [];

    for (const editorId of selected) {
      const config = EDITOR_CONFIGS[editorId];

      if (config.configType === "cli") {
        // Claude Code: use `claude mcp add`
        const result = runClaudeMcpAdd(ctx.readonlyKey!);
        if (result.success) {
          p.log.success(`Configured ${config.name}`);
          configuredEditors.push(config.name);
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
          configuredEditors.push(config.name);
        } catch (err) {
          p.log.warn(
            `Could not configure ${config.name}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }

    ctx.editorsConfigured = configuredEditors;
    ctx.completedSteps.push("setup-mcp");
    return { status: "completed" };
  },
};

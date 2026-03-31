import { randomBytes } from "node:crypto";
import open from "open";
import * as p from "@clack/prompts";
import pc from "picocolors";
import type { Step, StepResult, WizardContext } from "../types.js";
import { startCallbackServer } from "../utils/localhost-server.js";

const API_BASE = "https://www.thecontext.company";
const AUTH_TIMEOUT_MS = 30_000;

/** Active server reference for cleanup on Ctrl+C */
let activeServer: { close: () => void } | null = null;

async function handleAuthTimeout(
  ctx: WizardContext,
): Promise<StepResult> {
  p.log.warn("Authentication timed out after 30 seconds.");
  p.log.info(
    "You can get your API key from https://www.thecontext.company/prod/settings",
  );

  const key = await p.text({
    message: "Paste your TCC API key (or press Enter to skip):",
    placeholder: "tcc_prod_...",
    validate(value) {
      if (
        value &&
        !value.startsWith("tcc_prod_") &&
        !value.startsWith("tcc_key_")
      ) {
        return "Key must start with tcc_prod_ or tcc_key_";
      }
    },
  });

  if (p.isCancel(key) || !key) {
    return {
      status: "failed",
      message:
        "Authentication required. Run again or use --key flag.",
    };
  }

  ctx.apiKey = key;
  ctx.keyProvided = true;
  return {
    status: "completed",
    message:
      "Using manually provided key (MCP and Slack setup will be skipped)",
  };
}

export const authStep: Step = {
  name: "authenticate",

  async shouldRun(ctx: WizardContext): Promise<boolean> {
    // --key flag skips auth entirely (AUTH-03)
    if (ctx.keyProvided) return false;
    // Already authenticated (idempotency)
    if (ctx.accessToken) return false;
    return true;
  },

  async run(ctx: WizardContext): Promise<StepResult> {
    try {
      // 1. Generate CSRF state
      const state = randomBytes(16).toString("hex");

      // 2. Start localhost callback server
      const server = await startCallbackServer(state, AUTH_TIMEOUT_MS);
      activeServer = server;

      // 3. Open browser for authentication
      p.log.info("Opening browser for authentication...");
      const url = `${API_BASE}/api/cli/auth/start?port=${server.port}&state=${state}`;
      await open(url);

      // 4. Wait for callback
      p.log.info(
        pc.dim("Waiting for authentication... (30s timeout)"),
      );
      const result = await server.waitForCallback();
      activeServer = null;

      // 5. Handle timeout or state mismatch
      if (!result) {
        return handleAuthTimeout(ctx);
      }

      // 6. Exchange code for tokens
      const response = await fetch(`${API_BASE}/api/cli/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: result.code }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(
          (errorBody as { error?: string }).error ||
            `Authentication failed (${response.status})`,
        );
      }

      const data = (await response.json()) as {
        accessToken: string;
        refreshToken: string;
        user: { id: string; email: string; firstName?: string };
        organizationId: string | null;
      };

      // 7. Store in context only (AUTH-05: never persist to disk)
      ctx.accessToken = data.accessToken;
      ctx.refreshToken = data.refreshToken;
      ctx.user = data.user;
      ctx.organizationId = data.organizationId ?? undefined;

      // 8. Check for organization
      if (!data.organizationId) {
        p.log.warn(
          "No organization found. You may need to join or create an organization at https://www.thecontext.company",
        );
        return {
          status: "failed",
          message: "No organization found for key provisioning",
        };
      }

      p.log.success(`Authenticated as ${data.user.email}`);
      return { status: "completed" };
    } catch (error) {
      activeServer?.close();
      activeServer = null;

      const message =
        error instanceof Error ? error.message : String(error);
      p.log.error(`Authentication failed: ${message}`);
      return handleAuthTimeout(ctx);
    }
  },

  async cleanup(_ctx: WizardContext): Promise<void> {
    activeServer?.close();
    activeServer = null;
  },
};

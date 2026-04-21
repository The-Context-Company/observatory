import { randomBytes } from "node:crypto";
import open from "open";
import * as p from "@clack/prompts";
import pc from "picocolors";
import type { Step, StepResult, WizardContext } from "../types.js";
import { getApiBase } from "../utils/config.js";
import { startCallbackServer } from "../utils/localhost-server.js";

const AUTH_TIMEOUT_MS = 30_000;

/** Active server reference for cleanup on Ctrl+C */
let activeServer: { close: () => void } | null = null;

export const authStep: Step = {
  name: "authenticate",

  async shouldRun(ctx: WizardContext): Promise<boolean> {
    // Idempotency — don't re-auth if we already hold a valid token.
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

      const url = `${getApiBase()}/cli/auth/start?port=${server.port}&state=${state}`;

      // 3. Tell the user what's about to happen, then wait for acknowledgement
      //    so they don't get surprised by a browser window appearing.
      p.note(
        `We'll open your browser to sign in to The Context Company.\n${pc.dim(url)}`,
        "Sign in",
      );

      const proceed = await p.confirm({
        message: "Open browser to continue?",
        initialValue: true,
      });

      if (p.isCancel(proceed) || !proceed) {
        server.close();
        activeServer = null;
        return { status: "failed", message: "User cancelled" };
      }

      // 4. Open browser for authentication
      await open(url);

      // 4. Wait for callback
      p.log.info(
        pc.dim("Waiting for authentication... (30s timeout)"),
      );
      const result = await server.waitForCallback();
      activeServer = null;

      // 5. Handle timeout or state mismatch
      if (!result) {
        return {
          status: "failed",
          message: "Authentication timed out — re-run liftoff to try again.",
        };
      }

      // 6. Exchange code for tokens
      const response = await fetch(`${getApiBase()}/cli/auth`, {
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
      return { status: "failed", message };
    }
  },

  async cleanup(_ctx: WizardContext): Promise<void> {
    activeServer?.close();
    activeServer = null;
  },
};

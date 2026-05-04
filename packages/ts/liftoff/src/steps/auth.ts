import { randomBytes } from "node:crypto";
import open from "open";
import * as p from "@clack/prompts";
import pc from "picocolors";
import type { Step, StepResult, WizardContext } from "../types.js";
import { getApiBase } from "../utils/config.js";
import { startCallbackServer } from "../utils/localhost-server.js";

const AUTH_TIMEOUT_MS = 300_000; // 5 min — covers first-time signup + 2FA

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
        `${pc.bold("We'll open your browser to sign in to The Context Company.")}\n${pc.dim(url)}`,
        "Sign in",
      );

      const proceed = await p.confirm({
        message: "Open browser to continue?",
        initialValue: true,
      });

      if (p.isCancel(proceed) || !proceed) {
        server.close();
        activeServer = null;
        // Sign-in is optional — skipping just means we won't provision
        // an API key or MCP OAuth here. The success summary points the
        // user at the dashboard to grab a key manually.
        p.log.info(
          pc.dim(
            "Continuing without sign-in. You'll grab your API key from the dashboard at the end.",
          ),
        );
        return { status: "skipped", message: "User skipped sign-in" };
      }

      // 4. Open browser for authentication
      await open(url);

      // 4. Wait for callback. Swap out the pipeline's global SIGINT
      //    handler (which exits the process) for a step-local one that
      //    just closes the OAuth server and unblocks waitForCallback.
      //    Ctrl+C should skip auth, not kill the wizard — and after
      //    we're done waiting, the global handler is restored.
      p.log.info(
        pc.dim("Waiting for authentication... (Ctrl+C to skip, 5 min timeout)"),
      );

      const globalSigintHandlers = process.listeners(
        "SIGINT",
      ) as NodeJS.SignalsListener[];
      const globalSigtermHandlers = process.listeners(
        "SIGTERM",
      ) as NodeJS.SignalsListener[];
      process.removeAllListeners("SIGINT");
      process.removeAllListeners("SIGTERM");

      let userCancelledAuth = false;
      const stepSignalHandler = (): void => {
        userCancelledAuth = true;
        server.close();
      };
      process.once("SIGINT", stepSignalHandler);
      process.once("SIGTERM", stepSignalHandler);

      let result: { code: string; state: string } | null;
      try {
        result = await server.waitForCallback();
      } finally {
        process.removeListener("SIGINT", stepSignalHandler);
        process.removeListener("SIGTERM", stepSignalHandler);
        for (const h of globalSigintHandlers) {
          process.on("SIGINT", h);
        }
        for (const h of globalSigtermHandlers) {
          process.on("SIGTERM", h);
        }
      }
      activeServer = null;

      // 5. Handle Ctrl+C — non-fatal, wizard continues without auth.
      if (userCancelledAuth) {
        p.log.info(
          pc.dim(
            "Sign-in cancelled. Continuing without it — grab your API key from the dashboard at the end.",
          ),
        );
        return {
          status: "skipped",
          message: "Sign-in cancelled by user",
        };
      }

      // 6. Handle timeout or state mismatch — also non-fatal; pipeline
      //    continues and the user finishes setup with a manual key.
      if (!result) {
        p.log.warn(
          "Sign-in timed out. Continuing without it — grab your API key from the dashboard at the end.",
        );
        return {
          status: "skipped",
          message: "Authentication timed out",
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
          "Signed in, but no organization found. Create one in the dashboard, then re-run liftoff or grab a key manually.",
        );
        // Non-fatal: pipeline continues, success-summary points the
        // user at the dashboard for manual key generation.
        return {
          status: "skipped",
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
      p.log.warn(
        `Sign-in error: ${message}. Continuing without it — grab your API key from the dashboard at the end.`,
      );
      return { status: "skipped", message };
    }
  },

  async cleanup(_ctx: WizardContext): Promise<void> {
    activeServer?.close();
    activeServer = null;
  },
};

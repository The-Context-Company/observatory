import { randomBytes } from "node:crypto";
import open from "open";
import * as p from "@clack/prompts";
import pc from "picocolors";
import type { Step, StepResult, WizardContext } from "../types.js";
import { getApiBase } from "../utils/config.js";
import { startCallbackServer } from "../utils/localhost-server.js";

const AUTH_TIMEOUT_MS = 300_000; // 5 min, covers first-time signup + 2FA

let activeServer: { close: () => void } | null = null;

export const authStep: Step = {
  name: "authenticate",

  async shouldRun(ctx: WizardContext): Promise<boolean> {
    if (ctx.accessToken) return false;
    return true;
  },

  async run(ctx: WizardContext): Promise<StepResult> {
    try {
      const state = randomBytes(16).toString("hex");
      const server = await startCallbackServer(state, AUTH_TIMEOUT_MS);
      activeServer = server;

      const url = `${getApiBase()}/cli/auth/start?port=${server.port}&state=${state}`;

      // Acknowledgement gate so a browser window doesn't appear out of
      // nowhere.
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
        p.log.info(
          pc.dim(
            "Continuing without sign-in. You'll grab your API key from the dashboard at the end.",
          ),
        );
        return { status: "skipped", message: "User skipped sign-in" };
      }

      await open(url);

      // Swap the pipeline's global SIGINT handler (which exits the
      // process) for a step-local one that just closes the OAuth server
      // and unblocks waitForCallback. Ctrl+C here should skip auth, not
      // kill the wizard. The global handler is restored after the wait.
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

      if (!result) {
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
        p.log.warn(
          "Sign-in failed or timed out. Continuing without it — grab your API key from the dashboard at the end.",
        );
        return {
          status: "skipped",
          message: "Authentication failed or timed out",
        };
      }

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

      ctx.accessToken = data.accessToken;
      ctx.refreshToken = data.refreshToken;
      ctx.user = data.user;
      ctx.organizationId = data.organizationId ?? undefined;

      if (!data.organizationId) {
        p.log.warn(
          "Signed in, but no organization found. Create one in the dashboard, then re-run liftoff or grab a key manually.",
        );
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

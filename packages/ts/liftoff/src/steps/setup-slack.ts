import crypto from "node:crypto";
import * as p from "@clack/prompts";
import pc from "picocolors";
import type { Step, StepResult, WizardContext } from "../types.js";
import { getApiBase } from "../utils/config.js";
import { startCallbackServer } from "../utils/localhost-server.js";

const SLACK_SCOPES = [
  "channels:history",
  "channels:read",
  "chat:write",
  "chat:write.public",
  "commands",
  "channels:join",
  "groups:read",
  "im:history",
  "im:read",
].join(",");

/** Module-level close function so cleanup can reach it */
let closeServer: (() => void) | null = null;

/**
 * Fetch the Slack client ID from the context repo API.
 * Returns null on failure (caller should skip gracefully).
 */
async function fetchSlackClientId(
  accessToken: string,
): Promise<string | null> {
  try {
    const res = await fetch(`${getApiBase()}/cli/slack-client-id`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { clientId?: string };
    return data.clientId ?? null;
  } catch {
    return null;
  }
}

/**
 * Exchange the OAuth code on the server side (CLI cannot hold client secret).
 */
async function exchangeSlackCode(
  accessToken: string,
  code: string,
  redirectUri: string,
): Promise<{ ok: true; teamName: string } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${getApiBase()}/cli/slack-callback`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code, redirectUri }),
    });
    const data = (await res.json()) as {
      ok: boolean;
      teamName?: string;
      error?: string;
    };
    if (data.ok && data.teamName) {
      return { ok: true, teamName: data.teamName };
    }
    return { ok: false, error: data.error ?? "Unknown error" };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Pipeline step: connect the user's Slack workspace for alerts.
 *
 * Prompts for confirmation, opens browser to Slack OAuth, receives the
 * callback on a localhost server, exchanges the code via the context repo
 * API, and shows post-connect guidance.
 */
export const setupSlackStep: Step = {
  name: "setup-slack",

  async shouldRun(ctx: WizardContext): Promise<boolean> {
    if (ctx.completedSteps.includes("setup-slack")) return false;
    // Needs a valid access token — the Slack exchange route is
    // authenticated against the TCC user session.
    return !!ctx.accessToken;
  },

  async run(ctx: WizardContext): Promise<StepResult> {
    p.log.info(
      "The TCC Slack bot delivers configurable reports and alerts to your\n" +
        "workspace — notifying you about regressions and patterns you'd miss\n" +
        "otherwise.",
    );

    const wantsSlack = await p.confirm({
      message: "Set up our Slack bot?",
      initialValue: true,
    });

    if (p.isCancel(wantsSlack) || !wantsSlack) {
      return { status: "skipped", message: "Slack setup skipped" };
    }

    p.log.info(pc.dim("We'll open your browser to connect a Slack workspace."));

    // Fetch Slack client ID from server
    const clientId = await fetchSlackClientId(ctx.accessToken!);
    if (!clientId) {
      p.log.warn(
        "Could not retrieve Slack configuration. Skipping Slack setup.",
      );
      return {
        status: "skipped",
        message: "Failed to fetch Slack client ID",
      };
    }

    // Start OAuth flow (SLK-02)
    const state = crypto.randomBytes(16).toString("hex");
    const { port, waitForCallback, close } =
      await startCallbackServer(state, 300_000); // 5 min — covers first-time Slack install + workspace pick
    closeServer = close;

    const redirectUri = `http://127.0.0.1:${port}/callback`;
    const slackOAuthUrl =
      `https://slack.com/oauth/v2/authorize` +
      `?client_id=${clientId}` +
      `&scope=${encodeURIComponent(SLACK_SCOPES)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&state=${state}`;

    // Open browser
    const openModule = await import("open");
    await openModule.default(slackOAuthUrl);

    // Wait for callback
    const s = p.spinner();
    s.start("Waiting for Slack authorization...");
    const result = await waitForCallback();
    s.stop();

    if (!result) {
      close();
      closeServer = null;
      p.log.warn(
        "Slack authorization timed out or was cancelled.",
      );
      return {
        status: "skipped",
        message: "Slack auth timed out",
      };
    }

    // Exchange code via server endpoint
    const exchange = await exchangeSlackCode(
      ctx.accessToken!,
      result.code,
      redirectUri,
    );
    close();
    closeServer = null;

    if (!exchange.ok) {
      p.log.warn(
        `Could not complete Slack setup: ${exchange.error}`,
      );
      return {
        status: "skipped",
        message: "Slack token exchange failed",
      };
    }

    // Success
    p.log.success(
      `Connected to Slack workspace: ${exchange.teamName}`,
    );
    ctx.slackConnected = true;

    // Post-connect guidance (SLK-03)
    p.log.info(
      pc.cyan("Next steps for Slack alerts:\n") +
        "1. Add the Context Company bot to a channel\n" +
        "2. Type /subscribe in that channel to start receiving alerts",
    );

    // Pipeline pushes step.name on "completed" — don't push again.
    return { status: "completed" };
  },

  async cleanup(_ctx: WizardContext): Promise<void> {
    if (closeServer) {
      closeServer();
      closeServer = null;
    }
  },
};

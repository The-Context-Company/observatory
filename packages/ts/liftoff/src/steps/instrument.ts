import { execSync } from "node:child_process";
import * as p from "@clack/prompts";
import pc from "picocolors";
import {
  FRAMEWORKS,
  type Step,
  type StepResult,
  type WizardContext,
} from "../types.js";
import { getApiBase } from "../utils/config.js";

/** Timeout for the prompt fetch (ms). */
const FETCH_TIMEOUT_MS = 10_000;

/**
 * Response shape for GET /cli/prompts?framework=<id>[&lang=<lang>].
 *
 * Lives in context/public-api and is sourced from the onboarding
 * prompts module in context/demo. Liftoff never builds the prompt
 * itself — it only fetches and displays what the API returns.
 */
interface PromptResponse {
  /** Full prompt text for the user's coding agent. */
  prompt: string;
  /** Docs deep-link for this framework (shown as fallback hint). */
  docsUrl?: string;
  /** Human-readable framework name (used in messaging). */
  frameworkName?: string;
}

/**
 * Pipeline step: hand off instrumentation to the user's coding agent.
 *
 * Liftoff does not edit the user's application code. Instead, it
 * fetches a framework-specific prompt from the Context Company API
 * (`/cli/prompts`), displays it, and copies it to the clipboard so
 * the user can paste it into Claude Code, Cursor, Windsurf, or any
 * other AI coding agent that has full repo context. The agent makes
 * the edits — liftoff just orchestrates the handoff.
 *
 * Rationale: large real-world codebases exceed anything liftoff can
 * reasonably snapshot + send to a backend model, and template-based
 * fallbacks produce hallucinated API calls against a moving SDK. The
 * user's agent has the full repo, the user's own conventions, and
 * live access to the docs site.
 */
export const instrumentStep: Step = {
  name: "instrument",

  async shouldRun(ctx: WizardContext): Promise<boolean> {
    return (
      !!ctx.framework && !ctx.completedSteps.includes("instrument")
    );
  },

  async run(ctx: WizardContext): Promise<StepResult> {
    const fw = FRAMEWORKS.find((f) => f.id === ctx.framework);
    const fwDisplayName = fw?.name ?? ctx.framework ?? "your framework";

    const response = await fetchPrompt(ctx);

    if (!response) {
      const fallbackUrl =
        fw?.docsUrl ?? "https://docs.thecontext.company";
      p.log.warn(
        `Couldn't fetch the instrumentation prompt for ${fwDisplayName}.\n` +
          pc.dim(`Follow the docs manually: ${fallbackUrl}`),
      );
      ctx.completedSteps.push("instrument");
      return {
        status: "skipped",
        message: "Prompt fetch failed — user directed to docs",
      };
    }

    // The prompt is long (~100 lines). Don't dump it into the
    // terminal — just offer to copy it. The user pastes it into
    // their coding agent and reads it there.
    p.log.info(
      `We've got a tailored instrumentation prompt for ${pc.bold(response.frameworkName ?? fwDisplayName)}.\n` +
        pc.dim(
          "It tells your coding agent how to install the SDK, wire\n" +
            "instrumentation, and attach metadata against this codebase.",
        ),
    );

    const wantCopy = await p.confirm({
      message: "Copy the prompt to your clipboard?",
      initialValue: true,
    });

    if (p.isCancel(wantCopy) || !wantCopy) {
      p.log.info(
        pc.dim(
          `Skipped. You can grab the prompt later from the docs: ${response.docsUrl ?? fw?.docsUrl ?? "https://docs.thecontext.company"}`,
        ),
      );
      ctx.completedSteps.push("instrument");
      return { status: "skipped", message: "User declined prompt copy" };
    }

    const copied = copyToClipboard(response.prompt);
    if (!copied) {
      p.log.warn(
        "Clipboard copy failed. Grab the prompt from the docs instead:\n" +
          pc.underline(
            response.docsUrl ??
              fw?.docsUrl ??
              "https://docs.thecontext.company",
          ),
      );
      ctx.completedSteps.push("instrument");
      return { status: "skipped", message: "Clipboard unavailable" };
    }

    p.log.success("Prompt copied to your clipboard.");
    p.log.step(
      "Open a new tab in your AI coding agent (Claude Code, Cursor, Windsurf, …)\n" +
        "and paste it. The agent will install the SDK and wire up instrumentation.",
    );

    ctx.completedSteps.push("instrument");
    return {
      status: "completed",
      message: "Prompt handed off to user's coding agent",
    };
  },
};

/**
 * Fetch the framework-specific prompt from the public API. Returns
 * null on timeout, network error, non-2xx, or malformed response —
 * the step falls back to showing a docs URL in any of those cases.
 */
async function fetchPrompt(
  ctx: WizardContext,
): Promise<PromptResponse | null> {
  const params = new URLSearchParams({ framework: ctx.framework! });
  if (ctx.language === "python" || ctx.language === "typescript") {
    params.set("lang", ctx.language);
  }
  const url = `${getApiBase()}/cli/prompts?${params.toString()}`;

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    FETCH_TIMEOUT_MS,
  );

  const spinner = p.spinner();
  spinner.start("Fetching instrumentation prompt...");

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      spinner.stop("Prompt fetch failed");
      return null;
    }
    const data = (await response.json()) as PromptResponse;
    if (!data || typeof data.prompt !== "string" || !data.prompt) {
      spinner.stop("Prompt fetch returned no content");
      return null;
    }
    spinner.stop("Prompt ready");
    return data;
  } catch {
    spinner.stop("Prompt fetch failed");
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Copy a string to the system clipboard using the platform native
 * clipboard tool. Returns true on success, false on any failure.
 *
 * - macOS: `pbcopy`
 * - Windows: `clip`
 * - Linux: `xclip -selection clipboard`, falling back to `xsel`
 */
function copyToClipboard(text: string): boolean {
  try {
    if (process.platform === "darwin") {
      execSync("pbcopy", { input: text });
      return true;
    }
    if (process.platform === "win32") {
      execSync("clip", { input: text });
      return true;
    }
    try {
      execSync("xclip -selection clipboard", {
        input: text,
        stdio: ["pipe", "ignore", "ignore"],
      });
      return true;
    } catch {
      execSync("xsel --clipboard --input", {
        input: text,
        stdio: ["pipe", "ignore", "ignore"],
      });
      return true;
    }
  } catch {
    return false;
  }
}


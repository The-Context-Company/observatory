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

const FETCH_TIMEOUT_MS = 10_000;

interface PromptResponse {
  prompt: string;
  docsUrl?: string;
  frameworkName?: string;
}
// Fetches a framework-specific prompt from the API and hands it off via
// the clipboard so the user's coding agent (which already has full repo
// context) does the actual instrumentation. We don't edit user code
// here: real codebases exceed what we can snapshot, and template-based
// fallbacks hallucinate against moving SDKs.
export const instrumentStep: Step = {
  name: "instrument",

  async shouldRun(ctx: WizardContext): Promise<boolean> {
    return !!ctx.framework && !ctx.completedSteps.includes("instrument");
  },

  async run(ctx: WizardContext): Promise<StepResult> {
    const fw = FRAMEWORKS.find((f) => f.id === ctx.framework);
    const fwDisplayName = fw?.name ?? ctx.framework ?? "your framework";

    const response = await fetchPrompt(ctx);

    if (!response) {
      const fallbackUrl = fw?.docsUrl ?? "https://docs.thecontextcompany.com";
      p.log.warn(
        `Couldn't fetch the instrumentation prompt for ${fwDisplayName}.\n` +
          pc.dim(`Follow the docs manually: ${fallbackUrl}`)
      );
      ctx.completedSteps.push("instrument");
      return {
        status: "skipped",
        message: "Prompt fetch failed — user directed to docs",
      };
    }

    // Extra gap above the heading signals "new chapter".
    p.log.message("");
    p.log.step(pc.bold("Instrumentation"));
    p.log.info(
      `Tailored prompt for ${pc.bold(response.frameworkName ?? fwDisplayName)} that tells your coding agent how to install and wire the SDK against this codebase.`
    );

    const wantCopy = await p.confirm({
      message: "Copy the prompt to your clipboard?",
      initialValue: true,
    });

    if (p.isCancel(wantCopy) || !wantCopy) {
      p.log.info(
        pc.dim(
          `Skipped. You can grab the prompt later from the docs: ${response.docsUrl ?? fw?.docsUrl ?? "https://docs.thecontextcompany.com"}`
        )
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
              "https://docs.thecontextcompany.com"
          )
      );
      ctx.completedSteps.push("instrument");
      return { status: "skipped", message: "Clipboard unavailable" };
    }

    p.log.success("Prompt copied to your clipboard.");

    // Gap so the paste instruction pairs with the confirm below
    // instead of attaching to the copy receipt above.
    p.log.message("");
    p.log.info(
      "Paste it into your AI coding agent (Claude Code, Cursor, Windsurf, …) and come back here."
    );

    // Gate on explicit acknowledgement so the wizard doesn't blow past
    // the paste step.
    const ready = await p.confirm({
      message: "Ready to continue here while your agent works?",
      initialValue: true,
    });

    if (p.isCancel(ready) || !ready) {
      return { status: "failed", message: "User cancelled" };
    }

    ctx.promptCopied = true;

    return {
      status: "completed",
      message: "Prompt handed off to user's coding agent",
    };
  },
};

// Returns null on timeout, network error, non-2xx, or malformed
// response. The step falls back to showing a docs URL in those cases.
async function fetchPrompt(ctx: WizardContext): Promise<PromptResponse | null> {
  const params = new URLSearchParams({ framework: ctx.framework! });
  if (ctx.language === "python" || ctx.language === "typescript") {
    params.set("lang", ctx.language);
  }
  const url = `${getApiBase()}/cli/prompts?${params.toString()}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

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

// macOS: pbcopy. Windows: clip. Linux: xclip, falling back to xsel.
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

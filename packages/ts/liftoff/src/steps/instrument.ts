import fs from "node:fs";
import path from "node:path";
import * as p from "@clack/prompts";
import pc from "picocolors";
import type { Step, StepResult, WizardContext } from "../types.js";
import {
  collectCodebaseContext,
  type CodebaseContext,
} from "../utils/codebase-context.js";
import {
  reviewAndApplyChanges,
  type FileChange,
} from "../utils/diff-display.js";
import { detectGotchaFixes } from "../utils/gotcha-fixes.js";
import {
  getTemplate,
  type FileOperation,
} from "../utils/templates/index.js";

/** Base URL for production dashboard (hosts /api/cli/* endpoints) */
const PROD_API_URL = "https://www.thecontext.company";

/** Base URL for development dashboard */
const DEV_API_URL = "https://dev.thecontext.company";

/** Timeout for AI instrumentation request (ms) */
const AI_TIMEOUT_MS = 15_000;

/** AI response patch format */
interface AIPatch {
  filePath: string;
  action: "create" | "modify";
  content: string;
  description: string;
}

/** AI endpoint response */
interface AIResponse {
  patches: AIPatch[];
  metadata?: {
    sessionId?: boolean;
    userId?: boolean;
    conversational?: boolean;
  };
}

/**
 * Pipeline step: instrument the user's codebase.
 *
 * Orchestrates AI-first instrumentation with template fallback:
 * 1. Collect codebase context
 * 2. Try AI instrumentation (if authenticated, not --key mode)
 * 3. Fall back to templates on failure/timeout/decline
 * 4. Detect and append gotcha fixes
 * 5. Show colored diffs for all changes
 * 6. Apply user-accepted files
 */
export const instrumentStep: Step = {
  name: "instrument",

  async shouldRun(ctx: WizardContext): Promise<boolean> {
    return !!ctx.framework && !ctx.completedSteps.includes("instrument");
  },

  async run(ctx: WizardContext): Promise<StepResult> {
    // Step A: Collect codebase context
    const s = p.spinner();
    s.start("Analyzing your codebase...");

    let codebaseContext: CodebaseContext;
    try {
      codebaseContext = collectCodebaseContext(ctx);
    } catch (err) {
      s.stop("Codebase analysis failed");
      p.log.warn(
        `Could not analyze codebase: ${err instanceof Error ? err.message : String(err)}`,
      );
      codebaseContext = {
        framework: ctx.framework!,
        language: ctx.language ?? "unknown",
        typescript: ctx.typescript ?? false,
        srcDir: ctx.srcDir ?? false,
        files: [],
        existingInstrumentation: false,
      };
    }
    s.stop("Codebase analyzed");

    // Step B: Try AI instrumentation (if authenticated)
    let aiPatches: AIPatch[] | null = null;
    let aiMetadata: AIResponse["metadata"] | undefined;
    let usedAI = false;

    const shouldTryAI = !ctx.keyProvided && !!ctx.accessToken;

    if (shouldTryAI) {
      const aiResult = await tryAIInstrumentation(
        ctx,
        codebaseContext,
      );
      if (aiResult) {
        aiPatches = aiResult.patches;
        aiMetadata = aiResult.metadata;
        usedAI = true;
      }
    } else if (ctx.keyProvided) {
      p.log.info(
        pc.dim(
          "Using template instrumentation (--key mode, no AI)",
        ),
      );
    }

    // Step C: Fall back to templates if AI unavailable
    let fileOps: FileOperation[] = [];
    if (!aiPatches || aiPatches.length === 0) {
      const templateResult = await getTemplate(
        ctx.framework!,
        ctx,
      );
      fileOps = [...templateResult.files, ...templateResult.gotchaFixes];
      usedAI = false;
    }

    // Step D: Detect gotcha fixes
    const gotchaFixes = detectGotchaFixes(ctx);

    // Step E: Build FileChange array
    const changes: FileChange[] = [];

    if (aiPatches && aiPatches.length > 0) {
      // Convert AI patches to FileChange format
      for (const patch of aiPatches) {
        const absPath = path.join(ctx.installDir, patch.filePath);
        let oldContent = "";
        if (
          patch.action === "modify" &&
          fs.existsSync(absPath)
        ) {
          try {
            oldContent = fs.readFileSync(absPath, "utf-8");
          } catch {
            // Treat as new file if unreadable
          }
        }
        changes.push({
          filePath: patch.filePath,
          oldContent,
          newContent: patch.content,
          description: patch.description,
        });
      }
    } else {
      // Convert template FileOperations to FileChange format
      for (const op of fileOps) {
        const absPath = path.join(ctx.installDir, op.filePath);
        let oldContent = "";
        if (
          op.action === "modify" &&
          fs.existsSync(absPath)
        ) {
          try {
            oldContent = fs.readFileSync(absPath, "utf-8");
          } catch {
            // Treat as new file if unreadable
          }
        }
        changes.push({
          filePath: op.filePath,
          oldContent,
          newContent: op.content,
          description: op.description,
        });
      }
    }

    // Append gotcha fixes as additional FileChange items
    changes.push(...gotchaFixes);

    if (changes.length === 0) {
      p.log.info("No instrumentation changes needed.");
      ctx.completedSteps.push("instrument");
      return {
        status: "completed",
        message: "No changes needed",
      };
    }

    // Show diffs and collect accept/reject per file
    const { applied, skipped } =
      await reviewAndApplyChanges(changes);

    // Step F: Apply accepted changes
    for (const filePath of applied) {
      const change = changes.find((c) => c.filePath === filePath);
      if (!change) continue;

      const absPath = path.join(ctx.installDir, filePath);
      const dir = path.dirname(absPath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(absPath, change.newContent, "utf-8");
    }

    // Track which files were created vs modified
    ctx.filesCreated = [];
    ctx.filesModified = [];
    for (const filePath of applied) {
      const change = changes.find((c) => c.filePath === filePath);
      if (!change) continue;
      if (change.oldContent === "") {
        ctx.filesCreated.push(filePath);
      } else {
        ctx.filesModified.push(filePath);
      }
    }

    // Track metadata hooks if AI instrumentation was used
    if (usedAI && aiMetadata) {
      ctx.metadataHooks = aiMetadata;
    }

    // Log summary
    if (applied.length > 0) {
      p.log.success(
        `Applied ${pc.bold(String(applied.length))} file(s), skipped ${pc.bold(String(skipped.length))} file(s)`,
      );

      if (usedAI && aiMetadata) {
        p.log.info(
          pc.dim(
            `Metadata wired: sessionId: ${aiMetadata.sessionId ? "yes" : "TODO"}, userId: ${aiMetadata.userId ? "yes" : "TODO"}, conversational: yes`,
          ),
        );
      }
    } else {
      p.log.info("All changes skipped by user.");
    }

    // Step G: Return result
    ctx.completedSteps.push("instrument");
    const source = usedAI ? "AI" : "templates";

    if (applied.length > 0) {
      return {
        status: "completed",
        message: `Instrumented with ${source}`,
      };
    }

    return {
      status: "completed",
      message: "All changes skipped by user",
    };
  },
};

/**
 * Attempt AI-powered instrumentation via the /api/cli/instrument endpoint.
 *
 * Uses AbortController with a 15-second timeout to prevent hung CLI.
 * Returns null on any failure (timeout, network error, bad response).
 */
async function tryAIInstrumentation(
  ctx: WizardContext,
  codebaseContext: CodebaseContext,
): Promise<AIResponse | null> {
  const s = p.spinner();
  s.start("Generating project-specific instrumentation...");

  const baseUrl = ctx.apiKey?.startsWith("dev_")
    ? DEV_API_URL
    : PROD_API_URL;
  const url = `${baseUrl}/api/cli/instrument`;

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    AI_TIMEOUT_MS,
  );

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ctx.accessToken}`,
      },
      body: JSON.stringify({
        framework: ctx.framework,
        context: codebaseContext,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      s.stop("AI instrumentation unavailable");
      p.log.warn(
        `AI instrumentation unavailable (${response.status}), using template...`,
      );
      return null;
    }

    const data = (await response.json()) as AIResponse;

    if (!data.patches || data.patches.length === 0) {
      s.stop("AI returned no patches");
      p.log.warn(
        "AI returned no patches, using template...",
      );
      return null;
    }

    s.stop("AI instrumentation ready");
    return data;
  } catch (err) {
    s.stop("AI instrumentation unavailable");

    if (err instanceof Error && err.name === "AbortError") {
      p.log.warn(
        "AI instrumentation timed out, using template...",
      );
    } else {
      p.log.warn(
        `AI instrumentation unavailable, using template...`,
      );
    }

    return null;
  } finally {
    clearTimeout(timeout);
  }
}

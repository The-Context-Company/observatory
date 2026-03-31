import { execSync } from "node:child_process";
import * as p from "@clack/prompts";
import pc from "picocolors";
import type { Step, StepResult, WizardContext } from "../types.js";

export const gitCheckStep: Step = {
  name: "git-check",

  async shouldRun(_ctx: WizardContext): Promise<boolean> {
    // Always run -- this is a pre-flight check, not an idempotent action
    return true;
  },

  async run(ctx: WizardContext): Promise<StepResult> {
    try {
      const output = execSync("git status --porcelain", {
        cwd: ctx.installDir,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });

      const isDirty = output.trim().length > 0;
      ctx.gitDirty = isDirty;

      if (isDirty) {
        p.log.warn(
          pc.yellow(
            "Your working tree has uncommitted changes. " +
              "We recommend committing before running liftoff so you can " +
              "easily review or revert the changes we make.",
          ),
        );
      } else {
        p.log.success("Git working tree is clean.");
      }

      return { status: "completed" };
    } catch {
      // Not a git repo or git not installed -- that's fine, skip silently
      ctx.gitDirty = undefined;
      return {
        status: "completed",
        message: "Not a git repository (skipping git check)",
      };
    }
  },
};

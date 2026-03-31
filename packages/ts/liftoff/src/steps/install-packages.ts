import { execSync } from "node:child_process";
import * as p from "@clack/prompts";
import pc from "picocolors";
import { FRAMEWORK_PACKAGES, type Step, type StepResult, type WizardContext } from "../types.js";
import {
  getInstallCommand,
  isPackageInstalled,
} from "../utils/package-manager.js";

/**
 * Pipeline step: install the correct SDK packages for the detected framework.
 *
 * Looks up the required packages from FRAMEWORK_PACKAGES, filters out
 * already-installed ones, and runs the install command with a spinner.
 */
export const installPackagesStep: Step = {
  name: "install-packages",

  async shouldRun(ctx: WizardContext): Promise<boolean> {
    // Only run if framework has been detected/selected
    return !!ctx.framework;
  },

  async run(ctx: WizardContext): Promise<StepResult> {
    const allPackages = FRAMEWORK_PACKAGES[ctx.framework!];
    if (!allPackages || allPackages.length === 0) {
      p.log.warn("No packages to install for this framework.");
      return { status: "completed" };
    }

    // Filter out already-installed packages
    const packagesToInstall = allPackages.filter(
      (pkg) => !isPackageInstalled(ctx.installDir, pkg),
    );

    if (packagesToInstall.length === 0) {
      p.log.success("All packages already installed.");
      return { status: "completed" };
    }

    const command = getInstallCommand(
      ctx.packageManager!,
      packagesToInstall,
    );

    const s = p.spinner();
    s.start(
      `Installing ${packagesToInstall.map((pkg) => pc.bold(pkg)).join(", ")}...`,
    );

    try {
      execSync(command, {
        cwd: ctx.installDir,
        stdio: ["pipe", "pipe", "pipe"],
      });
      s.stop(
        `Installed ${packagesToInstall.map((pkg) => pc.bold(pkg)).join(", ")}`,
      );
      return { status: "completed" };
    } catch (err) {
      const stderr =
        err instanceof Error && "stderr" in err
          ? String((err as NodeJS.ErrnoException & { stderr: unknown }).stderr)
          : "";
      s.stop(pc.red("Package installation failed"));
      if (stderr) {
        console.error("[TCC] Install error:", stderr);
      }
      return {
        status: "failed",
        message: `Package installation failed. Run manually: ${command}`,
      };
    }
  },
};

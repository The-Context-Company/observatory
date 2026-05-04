import fs from "node:fs";
import * as p from "@clack/prompts";
import pc from "picocolors";
import type { Step, StepResult, WizardContext } from "../types.js";
import { getApiBase, getDashboardUrl } from "../utils/config.js";
import {
  ensureEnvFile,
  ensureGitignore,
  getEnvFilename,
  hasEnvVariable,
  setEnvVariable,
} from "../utils/env.js";
import { readPackageJson } from "../utils/file-utils.js";

// Determines whether to write .env.local (Next.js) or .env (other).
function isNextJsProject(installDir: string): boolean {
  const pkg = readPackageJson(installDir);
  if (!pkg) return false;
  const deps = {
    ...((pkg.dependencies as Record<string, string>) ?? {}),
    ...((pkg.devDependencies as Record<string, string>) ?? {}),
  };
  return "next" in deps;
}

export const provisionKeysStep: Step = {
  name: "provision-keys",

  async shouldRun(ctx: WizardContext): Promise<boolean> {
    if (ctx.completedSteps.includes("provision-keys")) return false;
    if (ctx.apiKey) return false;
    // The /cli/keys endpoint requires both a token and an org. Auth
    // can succeed but leave organizationId undefined (user not in any
    // org); skip cleanly in that case so the success summary points
    // them at the dashboard instead of bombing the wizard.
    return !!ctx.accessToken && !!ctx.organizationId;
  },

  async run(ctx: WizardContext): Promise<StepResult> {
    const spinner = p.spinner();

    try {
      spinner.start("Provisioning API key...");

      const response = await fetch(`${getApiBase()}/cli/keys`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ctx.accessToken}`,
        },
        body: JSON.stringify({
          organizationId: ctx.organizationId,
          type: "prod",
        }),
      });

      if (!response.ok) {
        const errorBody = await response
          .json()
          .catch(() => ({}) as Record<string, unknown>);
        spinner.stop("Key provisioning failed");
        const detail = (errorBody as { error?: string }).error || "unknown";
        p.log.warn(
          `Could not provision API key automatically. You can grab one from the dashboard:\n  ${pc.underline(`${getDashboardUrl()}/prod/settings`)}`,
        );
        return { status: "skipped", message: detail };
      }

      const data = (await response.json()) as {
        prodKey: { key: string; keyId: string };
      };

      ctx.apiKey = data.prodKey.key;
      spinner.stop("API key provisioned");

      // Write to .env[.local] when we can detect the convention, and
      // always print the key so users with their own secrets setup can
      // copy it.
      const isNextJs = isNextJsProject(ctx.installDir);
      const envFilename = getEnvFilename(isNextJs);
      const hasManifest =
        fs.existsSync(`${ctx.installDir}/package.json`) ||
        fs.existsSync(`${ctx.installDir}/pyproject.toml`) ||
        fs.existsSync(`${ctx.installDir}/requirements.txt`);

      let writeStatus: "written" | "kept-existing" | "no-manifest";
      if (!hasManifest) {
        writeStatus = "no-manifest";
      } else {
        const envPath = ensureEnvFile(ctx.installDir, isNextJs);
        if (hasEnvVariable(envPath, "TCC_API_KEY")) {
          writeStatus = "kept-existing";
        } else {
          setEnvVariable(envPath, "TCC_API_KEY", data.prodKey.key);
          ensureGitignore(ctx.installDir, envFilename);
          writeStatus = "written";
        }
      }

      p.note(
        `${pc.bold("TCC_API_KEY")}   ${data.prodKey.key}\n\n` +
          (writeStatus === "written"
            ? pc.dim(`Written to ${envFilename} and added to .gitignore.`)
            : writeStatus === "kept-existing"
              ? pc.yellow(
                  `TCC_API_KEY already exists in ${envFilename} — kept the existing value. Update it manually if you want to use the new key above.`,
                )
              : pc.dim(
                  `No project manifest detected (no package.json / pyproject.toml). Add the key above to your environment however you handle secrets.`,
                )),
        "API key",
      );

      return { status: "completed" };
    } catch (error) {
      spinner.stop("Key provisioning failed");
      const message =
        error instanceof Error ? error.message : String(error);
      p.log.warn(
        `Could not provision API key: ${message}. You can grab one from the dashboard:\n  ${pc.underline(`${getDashboardUrl()}/prod/settings`)}`,
      );
      return { status: "skipped", message };
    }
  },
};

import * as p from "@clack/prompts";
import pc from "picocolors";
import type { Step, StepResult, WizardContext } from "../types.js";
import {
  ensureEnvFile,
  hasEnvVariable,
  setEnvVariable,
  getEnvFilename,
  ensureGitignore,
} from "../utils/env.js";
import { readPackageJson } from "../utils/file-utils.js";

/** Public API base URL (hosts /cli/* routes) */
const API_BASE = "https://api.thecontext.company";

/**
 * Lightweight Next.js detection via package.json dependencies.
 * Used to determine whether to write .env.local (Next.js) or .env (other).
 */
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
    // Needs a valid access token from the auth step.
    return !!ctx.accessToken;
  },

  async run(ctx: WizardContext): Promise<StepResult> {
    const spinner = p.spinner();

    try {
      spinner.start("Provisioning API keys...");

      const response = await fetch(`${API_BASE}/cli/keys`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ctx.accessToken}`,
        },
        body: JSON.stringify({ organizationId: ctx.organizationId }),
      });

      if (!response.ok) {
        const errorBody = await response
          .json()
          .catch(() => ({}) as Record<string, unknown>);
        spinner.stop("Key provisioning failed");
        const detail = (errorBody as { error?: string }).error || "unknown";
        p.log.error(`Status: ${response.status} | Error: ${detail} | OrgId sent: ${ctx.organizationId ?? "null"}`);
        return {
          status: "failed",
          message: detail,
        };
      }

      const data = (await response.json()) as {
        prodKey: { key: string; keyId: string };
        readonlyKey: { key: string; keyId: string };
      };

      // Determine env file based on framework
      const isNextJs = isNextJsProject(ctx.installDir);
      const envPath = ensureEnvFile(ctx.installDir, isNextJs);
      const envFilename = getEnvFilename(isNextJs);

      const written: string[] = [];
      const skipped: string[] = [];

      // Write TCC_API_KEY (KEY-01, KEY-04: never overwrite)
      if (hasEnvVariable(envPath, "TCC_API_KEY")) {
        skipped.push("TCC_API_KEY");
        p.log.warn(
          "TCC_API_KEY already exists in " +
            envFilename +
            " \u2014 keeping existing value",
        );
      } else {
        setEnvVariable(envPath, "TCC_API_KEY", data.prodKey.key);
        written.push("TCC_API_KEY");
        ctx.apiKey = data.prodKey.key;
      }

      // Write TCC_READONLY_KEY (KEY-02, KEY-04: never overwrite)
      if (hasEnvVariable(envPath, "TCC_READONLY_KEY")) {
        skipped.push("TCC_READONLY_KEY");
        p.log.warn(
          "TCC_READONLY_KEY already exists in " +
            envFilename +
            " \u2014 keeping existing value",
        );
      } else {
        setEnvVariable(
          envPath,
          "TCC_READONLY_KEY",
          data.readonlyKey.key,
        );
        written.push("TCC_READONLY_KEY");
        ctx.readonlyKey = data.readonlyKey.key;
      }

      // Always ensure .gitignore includes the env file (KEY-05)
      ensureGitignore(ctx.installDir, envFilename);

      spinner.stop("API keys provisioned");

      if (written.length > 0) {
        p.log.success(
          `Written to ${envFilename}: ${written.join(", ")}`,
        );
      }
      if (skipped.length > 0) {
        p.log.info(
          pc.dim(
            `Skipped (already exist): ${skipped.join(", ")}`,
          ),
        );
      }

      return { status: "completed" };
    } catch (error) {
      spinner.stop("Key provisioning failed");
      const message =
        error instanceof Error ? error.message : String(error);
      p.log.error(`Key provisioning failed: ${message}`);
      return { status: "failed", message };
    }
  },
};

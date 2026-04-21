import * as p from "@clack/prompts";
import pc from "picocolors";
import { FRAMEWORKS, type Framework, type PackageManager, type Step, type StepResult, type WizardContext } from "../types.js";
import { detectFramework, detectLanguage } from "../utils/framework-detection.js";
import { detectPackageManager } from "../utils/package-manager.js";

/**
 * Pipeline step: detect the user's framework and package manager.
 *
 * Auto-detects the framework from project files and presents
 * it to the user for confirmation via an interactive select prompt.
 * If no framework is detected, the user picks manually from the list.
 */
export const detectFrameworkStep: Step = {
  name: "detect-framework",

  async shouldRun(ctx: WizardContext): Promise<boolean> {
    // Skip if framework is already set (idempotency)
    return !ctx.framework;
  },

  async run(ctx: WizardContext): Promise<StepResult> {
    // Auto-detect framework from project files
    const detected = detectFramework(ctx.installDir);
    const detectedLang = detectLanguage(ctx.installDir);

    // Show all 12 frameworks in a single list regardless of what was
    // detected. Detection can miss (polyglot repos, atypical manifests,
    // monorepo with one-language root manifest but a differently-typed
    // sub-app), so we always give the user an override. Language +
    // "detected" status surface in the hint column.
    const tsFirst = detectedLang !== "python";
    const orderedFrameworks = tsFirst
      ? [
          ...FRAMEWORKS.filter((f) => f.language === "typescript"),
          ...FRAMEWORKS.filter((f) => f.language === "python"),
        ]
      : [
          ...FRAMEWORKS.filter((f) => f.language === "python"),
          ...FRAMEWORKS.filter((f) => f.language === "typescript"),
        ];

    const makeOption = (f: (typeof FRAMEWORKS)[number]) => {
      const langLabel = f.language === "python" ? "python" : "typescript";
      const isDetected = f.id === detected;
      return {
        value: f.id as Framework,
        label: f.name,
        hint: isDetected ? `${langLabel} · detected` : langLabel,
      };
    };

    const choice = await p.select({
      message: "Which framework are you using?",
      options: orderedFrameworks.map(makeOption),
      initialValue: detected ?? undefined,
    });

    if (p.isCancel(choice)) {
      return { status: "failed", message: "User cancelled" };
    }

    ctx.framework = choice;
    // Resolve the language from the selection, not the filesystem —
    // so if the user overrides detection (picked a Python framework
    // in a repo that also had a package.json), we honor the override.
    ctx.language =
      FRAMEWORKS.find((f) => f.id === choice)?.language ?? "unknown";

    // Package manager: auto-detect from lockfile. Only prompt if the
    // detection is ambiguous — nobody needs to be asked what PM they
    // use when there's a pnpm-lock.yaml sitting right there.
    const detectedPm = detectPackageManager(ctx.installDir, language);

    if (detectedPm) {
      ctx.packageManager = detectedPm as PackageManager;
    } else {
      const pmOptions =
        language === "python"
          ? [
              { value: "pip", label: "pip" },
              { value: "uv", label: "uv" },
              { value: "poetry", label: "poetry" },
            ]
          : [
              { value: "npm", label: "npm" },
              { value: "pnpm", label: "pnpm" },
              { value: "yarn", label: "yarn" },
              { value: "bun", label: "bun" },
            ];
      const pmChoice = await p.select({
        message: "Which package manager do you use?",
        options: pmOptions,
      });
      if (p.isCancel(pmChoice)) {
        return { status: "failed", message: "Setup cancelled" };
      }
      ctx.packageManager = pmChoice as PackageManager;
    }

    const frameworkName =
      FRAMEWORKS.find((f) => f.id === ctx.framework)?.name ?? ctx.framework;

    p.log.success(
      `Framework: ${pc.bold(frameworkName)}${
        detectedPm ? pc.dim(` (${ctx.packageManager})`) : ""
      }`,
    );

    return { status: "completed" };
  },
};

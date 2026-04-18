import * as p from "@clack/prompts";
import pc from "picocolors";
import { FRAMEWORKS, type Framework, type PackageManager, type Step, type StepResult, type WizardContext } from "../types.js";
import { detectFramework, detectLanguage, detectTypeScript, detectSrcDir, detectAppRouter } from "../utils/framework-detection.js";
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

    // Split frameworks by language
    const tsFrameworks = FRAMEWORKS.filter((f) => f.language === "typescript");
    const pyFrameworks = FRAMEWORKS.filter((f) => f.language === "python");

    // Put the detected language group first
    const [firstGroup, firstLabel, secondGroup, secondLabel] =
      detectedLang === "python"
        ? [pyFrameworks, "Python", tsFrameworks, "TypeScript / JavaScript"]
        : [tsFrameworks, "TypeScript / JavaScript", pyFrameworks, "Python"];

    const makeOption = (f: (typeof FRAMEWORKS)[number]) => ({
      value: f.id as Framework,
      label: f.name,
      hint: f.id === detected ? "detected" : undefined,
    });

    const options = [
      { value: "__ts_header__" as Framework, label: pc.dim(`── ${firstLabel} ──`), hint: "" },
      ...firstGroup.map(makeOption),
      { value: "__py_header__" as Framework, label: pc.dim(`── ${secondLabel} ──`), hint: "" },
      ...secondGroup.map(makeOption),
    ];

    // Present framework selection
    const choice = await p.select({
      message: "Which framework are you using?",
      options,
      initialValue: detected ?? undefined,
    });

    if (p.isCancel(choice)) {
      return { status: "failed", message: "User cancelled" };
    }

    ctx.framework = choice;

    // Detect project characteristics (D-04, D-05)
    ctx.language = detectLanguage(ctx.installDir);
    ctx.typescript = detectTypeScript(ctx.installDir);
    ctx.srcDir = detectSrcDir(ctx.installDir);
    ctx.appDir = detectAppRouter(ctx.installDir);

    // Detect package manager, then confirm with user
    const detectedPm = detectPackageManager(ctx.installDir, ctx.language);

    const tsOptions = [
      { value: "npm", label: "npm" },
      { value: "pnpm", label: "pnpm" },
      { value: "yarn", label: "yarn" },
      { value: "bun", label: "bun" },
    ].map((opt) => ({
      ...opt,
      hint: opt.value === detectedPm ? "detected" : undefined,
    }));

    const pyOptions = [
      { value: "pip", label: "pip" },
      { value: "uv", label: "uv" },
      { value: "poetry", label: "poetry" },
    ].map((opt) => ({
      ...opt,
      hint: opt.value === detectedPm ? "detected" : undefined,
    }));

    const pmOptions = ctx.language === "python" ? pyOptions : tsOptions;

    const pmChoice = await p.select({
      message: "Which package manager do you use?",
      options: pmOptions,
      initialValue: detectedPm ?? undefined,
    });
    if (p.isCancel(pmChoice)) {
      return { status: "failed", message: "Setup cancelled" };
    }
    ctx.packageManager = pmChoice as PackageManager;

    const frameworkName =
      FRAMEWORKS.find((f) => f.id === ctx.framework)?.name ?? ctx.framework;

    p.log.success(
      `Framework: ${pc.bold(frameworkName)}, Package manager: ${pc.bold(ctx.packageManager)}`,
    );

    return { status: "completed" };
  },
};

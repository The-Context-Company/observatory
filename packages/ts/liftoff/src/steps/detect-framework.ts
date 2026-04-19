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

    const tsFrameworks = FRAMEWORKS.filter((f) => f.language === "typescript");
    const pyFrameworks = FRAMEWORKS.filter((f) => f.language === "python");

    // If we couldn't infer the language from project files, ask which one.
    // Otherwise, just show that language's frameworks — keeps the framework
    // prompt focused and avoids non-selectable group headers in the list.
    let language: "typescript" | "python";
    if (detectedLang === "typescript" || detectedLang === "python") {
      language = detectedLang;
    } else {
      const langChoice = await p.select({
        message: "Which language is this project in?",
        options: [
          { value: "typescript", label: "TypeScript / JavaScript" },
          { value: "python", label: "Python" },
        ],
      });
      if (p.isCancel(langChoice)) {
        return { status: "failed", message: "User cancelled" };
      }
      language = langChoice as "typescript" | "python";
    }

    const frameworksForLang =
      language === "python" ? pyFrameworks : tsFrameworks;

    const makeOption = (f: (typeof FRAMEWORKS)[number]) => ({
      value: f.id as Framework,
      label: f.name,
      hint: f.id === detected ? "detected" : undefined,
    });

    const choice = await p.select({
      message: `Which ${language === "python" ? "Python" : "TypeScript / JavaScript"} framework are you using?`,
      options: frameworksForLang.map(makeOption),
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

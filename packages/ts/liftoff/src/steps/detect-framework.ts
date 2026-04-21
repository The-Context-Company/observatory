import * as p from "@clack/prompts";
import pc from "picocolors";
import { FRAMEWORKS, type Framework, type PackageManager, type Step, type StepResult, type WizardContext } from "../types.js";
import { detectFramework, detectLanguage } from "../utils/framework-detection.js";
import { detectPackageManager } from "../utils/package-manager.js";

/**
 * Collapse per-language duplicates: LangChain/LangGraph and Custom each
 * have TS and Python flavors (langchain-ts/langchain-python,
 * custom-ts/custom-python). Showing both in a single list produced two
 * identical-looking rows. Instead, surface these as "families" — if
 * the user picks one, a second prompt resolves the language.
 */
type DisplayValue =
  | Framework
  | "__langchain__"
  | "__custom__";

interface DisplayEntry {
  value: DisplayValue;
  name: string;
  /** Language of the entry for sorting and hinting. "both" = family. */
  lang: "typescript" | "python" | "both";
}

const DISPLAY_ENTRIES: DisplayEntry[] = [
  { value: "nextjs-aisdk", name: "Vercel AI SDK", lang: "typescript" },
  { value: "claude-agent-sdk", name: "Claude Agent SDK", lang: "typescript" },
  { value: "mastra", name: "Mastra", lang: "typescript" },
  { value: "pi-mono", name: "Pi-Mono", lang: "typescript" },
  { value: "openclaw", name: "OpenClaw", lang: "typescript" },
  { value: "__langchain__", name: "LangChain / LangGraph", lang: "both" },
  { value: "__custom__", name: "Custom", lang: "both" },
  { value: "crewai", name: "CrewAI", lang: "python" },
  { value: "agno", name: "Agno", lang: "python" },
  { value: "litellm", name: "LiteLLM", lang: "python" },
];

/**
 * Given a detected framework id, return what should be pre-selected
 * in the display prompt. Maps language-specific ids (e.g.
 * "langchain-ts") to their family value ("__langchain__").
 */
function detectedToDisplayValue(
  detected: Framework | null,
): DisplayValue | undefined {
  if (!detected) return undefined;
  if (detected === "langchain-ts" || detected === "langchain-python") {
    return "__langchain__";
  }
  if (detected === "custom-ts" || detected === "custom-python") {
    return "__custom__";
  }
  return detected;
}

/**
 * If the user picked a family, we know from detection (or ask) which
 * language flavor. Pre-select the detected variant.
 */
function familyLangFromDetected(
  detected: Framework | null,
): "typescript" | "python" | undefined {
  if (detected === "langchain-ts" || detected === "custom-ts") return "typescript";
  if (detected === "langchain-python" || detected === "custom-python")
    return "python";
  return undefined;
}

/**
 * Pipeline step: detect the user's framework and package manager.
 *
 * Auto-detects the framework from project files and presents it for
 * confirmation. LangChain and Custom collapse to single entries with
 * a follow-up language prompt.
 */
export const detectFrameworkStep: Step = {
  name: "detect-framework",

  async shouldRun(ctx: WizardContext): Promise<boolean> {
    return !ctx.framework;
  },

  async run(ctx: WizardContext): Promise<StepResult> {
    const detected = detectFramework(ctx.installDir);
    const detectedLang = detectLanguage(ctx.installDir);

    // Order: put entries matching the detected language first,
    // "both" families in the middle, then the other language.
    const tsFirst = detectedLang !== "python";
    const primary = tsFirst ? "typescript" : "python";
    const secondary = tsFirst ? "python" : "typescript";
    const ordered = [
      ...DISPLAY_ENTRIES.filter((e) => e.lang === primary),
      ...DISPLAY_ENTRIES.filter((e) => e.lang === "both"),
      ...DISPLAY_ENTRIES.filter((e) => e.lang === secondary),
    ];

    const initialValue = detectedToDisplayValue(detected);

    const choice = await p.select({
      message: "Which framework are you using?",
      options: ordered.map((e) => {
        const langHint =
          e.lang === "both" ? "typescript + python" : e.lang;
        const isDetected = e.value === initialValue;
        return {
          value: e.value,
          label: e.name,
          hint: isDetected ? `${langHint} · detected` : langHint,
        };
      }),
      initialValue,
    });

    if (p.isCancel(choice)) {
      return { status: "failed", message: "User cancelled" };
    }

    // Resolve the display choice to a concrete Framework id.
    let framework: Framework;
    if (choice === "__langchain__" || choice === "__custom__") {
      const presetLang = familyLangFromDetected(detected);
      const langChoice = await p.select({
        message: `Is this a TypeScript or Python ${
          choice === "__langchain__" ? "LangChain" : "custom agent"
        } project?`,
        options: [
          { value: "typescript", label: "TypeScript" },
          { value: "python", label: "Python" },
        ],
        initialValue: presetLang,
      });
      if (p.isCancel(langChoice)) {
        return { status: "failed", message: "User cancelled" };
      }
      framework =
        choice === "__langchain__"
          ? langChoice === "python"
            ? "langchain-python"
            : "langchain-ts"
          : langChoice === "python"
            ? "custom-python"
            : "custom-ts";
    } else {
      framework = choice as Framework;
    }

    ctx.framework = framework;
    ctx.language =
      FRAMEWORKS.find((f) => f.id === framework)?.language ?? "unknown";

    // Package manager: auto-detect from lockfile. Only prompt if the
    // detection is ambiguous — nobody needs to be asked what PM they
    // use when there's a pnpm-lock.yaml sitting right there.
    const detectedPm = detectPackageManager(ctx.installDir, ctx.language);

    if (detectedPm) {
      ctx.packageManager = detectedPm as PackageManager;
    } else {
      const pmOptions =
        ctx.language === "python"
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

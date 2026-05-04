import * as p from "@clack/prompts";
import pc from "picocolors";
import { FRAMEWORKS, type Framework, type PackageManager, type Step, type StepResult, type WizardContext } from "../types.js";
import { detectFramework, detectLanguage } from "../utils/framework-detection.js";
import { detectPackageManager } from "../utils/package-manager.js";

// LangChain, Claude Agent SDK, and Custom each have TS and Python
// flavors. Collapse them into single "family" entries and ask for the
// language in a follow-up prompt to avoid two identical-looking rows
// in the picker.
type DisplayValue =
  | Framework
  | "__langchain__"
  | "__claude__"
  | "__custom__";

interface DisplayEntry {
  value: DisplayValue;
  name: string;
  /** "both" = family entry covering both languages. */
  lang: "typescript" | "python" | "both";
}

const DISPLAY_ENTRIES: DisplayEntry[] = [
  { value: "nextjs-aisdk", name: "Vercel AI SDK", lang: "typescript" },
  { value: "mastra", name: "Mastra", lang: "typescript" },
  { value: "pi-mono", name: "Pi-Mono", lang: "typescript" },
  { value: "openclaw", name: "OpenClaw", lang: "typescript" },
  { value: "__claude__", name: "Claude Agent SDK", lang: "both" },
  { value: "__langchain__", name: "LangChain / LangGraph", lang: "both" },
  { value: "__custom__", name: "Custom", lang: "both" },
  { value: "crewai", name: "CrewAI", lang: "python" },
  { value: "agno", name: "Agno", lang: "python" },
];

function detectedToDisplayValue(
  detected: Framework | null,
): DisplayValue | undefined {
  if (!detected) return undefined;
  if (detected === "langchain-ts" || detected === "langchain-python") {
    return "__langchain__";
  }
  if (
    detected === "claude-agent-sdk" ||
    detected === "claude-agent-sdk-python"
  ) {
    return "__claude__";
  }
  if (detected === "custom-ts" || detected === "custom-python") {
    return "__custom__";
  }
  return detected;
}

function familyLangFromDetected(
  detected: Framework | null,
): "typescript" | "python" | undefined {
  if (
    detected === "langchain-ts" ||
    detected === "claude-agent-sdk" ||
    detected === "custom-ts"
  )
    return "typescript";
  if (
    detected === "langchain-python" ||
    detected === "claude-agent-sdk-python" ||
    detected === "custom-python"
  )
    return "python";
  return undefined;
}

export const detectFrameworkStep: Step = {
  name: "detect-framework",

  async shouldRun(ctx: WizardContext): Promise<boolean> {
    return !ctx.framework;
  },

  async run(ctx: WizardContext): Promise<StepResult> {
    const detected = detectFramework(ctx.installDir);
    const detectedLang = detectLanguage(ctx.installDir);

    // Entries matching the detected language come first, families in
    // the middle, then the other language.
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
          e.lang === "both" ? "typescript & python" : e.lang;
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

    let framework: Framework;
    if (
      choice === "__langchain__" ||
      choice === "__claude__" ||
      choice === "__custom__"
    ) {
      const presetLang = familyLangFromDetected(detected);
      const familyName =
        choice === "__langchain__"
          ? "LangChain"
          : choice === "__claude__"
            ? "Claude Agent SDK"
            : "custom agent";
      const langChoice = await p.select({
        message: `Is this a TypeScript or Python ${familyName} project?`,
        options: [
          { value: "typescript", label: "TypeScript" },
          { value: "python", label: "Python" },
        ],
        initialValue: presetLang,
      });
      if (p.isCancel(langChoice)) {
        return { status: "failed", message: "User cancelled" };
      }
      if (choice === "__langchain__") {
        framework =
          langChoice === "python" ? "langchain-python" : "langchain-ts";
      } else if (choice === "__claude__") {
        framework =
          langChoice === "python"
            ? "claude-agent-sdk-python"
            : "claude-agent-sdk";
      } else {
        framework = langChoice === "python" ? "custom-python" : "custom-ts";
      }
    } else {
      framework = choice as Framework;
    }

    ctx.framework = framework;
    ctx.language =
      FRAMEWORKS.find((f) => f.id === framework)?.language ?? "unknown";

    // Auto-detect from lockfile, only prompt if ambiguous.
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
        ctx.packageManager && detectedPm ? pc.dim(` (${ctx.packageManager})`) : ""
      }`,
    );

    return { status: "completed" };
  },
};

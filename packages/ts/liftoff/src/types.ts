export type Framework =
  | "nextjs-aisdk"
  | "claude-agent-sdk"
  | "claude-agent-sdk-python"
  | "langchain-ts"
  | "mastra"
  | "pi-mono"
  | "openclaw"
  | "custom-ts"
  | "langchain-python"
  | "crewai"
  | "agno"
  | "custom-python";

export type PackageManager =
  | "npm"
  | "yarn"
  | "pnpm"
  | "bun"
  | "pip"
  | "poetry"
  | "uv";

export type ProjectLanguage = "typescript" | "python" | "unknown";

export interface FrameworkInfo {
  id: Framework;
  name: string;
  description: string;
  docsUrl: string;
  language: "typescript" | "python";
}

export const FRAMEWORKS: FrameworkInfo[] = [
  {
    id: "nextjs-aisdk",
    name: "Vercel AI SDK",
    description: "Instrument AI SDK calls in your Next.js app",
    docsUrl: "https://docs.thecontextcompany.com/frameworks/vercel-ai-sdk",
    language: "typescript",
  },
  {
    id: "claude-agent-sdk",
    name: "Claude Agent SDK",
    description: "Instrument Claude Agent SDK agents",
    docsUrl:
      "https://docs.thecontextcompany.com/frameworks/claude-agent-sdk#typescript",
    language: "typescript",
  },
  {
    id: "langchain-ts",
    name: "LangChain / LangGraph",
    description: "Instrument LangChain.js and LangGraph agents",
    docsUrl:
      "https://docs.thecontextcompany.com/frameworks/langchain-langgraph",
    language: "typescript",
  },
  {
    id: "mastra",
    name: "Mastra",
    description: "Instrument Mastra agents and workflows",
    docsUrl: "https://docs.thecontextcompany.com/frameworks/mastra",
    language: "typescript",
  },
  {
    id: "pi-mono",
    name: "Pi-Mono",
    description: "Instrument Pi coding agent",
    docsUrl: "https://docs.thecontextcompany.com/frameworks/pi-mono",
    language: "typescript",
  },
  {
    id: "openclaw",
    name: "OpenClaw",
    description: "Instrument OpenClaw agents",
    docsUrl: "https://docs.thecontextcompany.com/frameworks/openclaw",
    language: "typescript",
  },
  {
    id: "custom-ts",
    name: "Custom",
    description: "Manual instrumentation for custom agents",
    docsUrl:
      "https://docs.thecontextcompany.com/frameworks/custom-instrumentation/typescript/setup",
    language: "typescript",
  },
  {
    id: "langchain-python",
    name: "LangChain / LangGraph",
    description: "Instrument LangChain and LangGraph agents",
    docsUrl:
      "https://docs.thecontextcompany.com/frameworks/langchain-langgraph",
    language: "python",
  },
  {
    id: "claude-agent-sdk-python",
    name: "Claude Agent SDK",
    description: "Instrument Claude Agent SDK agents",
    docsUrl:
      "https://docs.thecontextcompany.com/frameworks/claude-agent-sdk#python",
    language: "python",
  },
  {
    id: "crewai",
    name: "CrewAI",
    description: "Instrument CrewAI agents",
    docsUrl: "https://docs.thecontextcompany.com/frameworks/crewai",
    language: "python",
  },
  {
    id: "agno",
    name: "Agno",
    description: "Instrument Agno agents",
    docsUrl: "https://docs.thecontextcompany.com/frameworks/agno",
    language: "python",
  },
  {
    id: "custom-python",
    name: "Custom",
    description: "Manual instrumentation for custom agents",
    docsUrl:
      "https://docs.thecontextcompany.com/frameworks/custom-instrumentation/python/setup",
    language: "python",
  },
];

export interface StepResult {
  status: "completed" | "skipped" | "failed";
  message?: string;
}

export interface Step {
  name: string;
  shouldRun(ctx: WizardContext): Promise<boolean>;
  run(ctx: WizardContext): Promise<StepResult>;
  cleanup?(ctx: WizardContext): Promise<void>;
}

export interface WizardContext {
  installDir: string;
  framework?: Framework;
  packageManager?: PackageManager;
  language?: ProjectLanguage;
  apiKey?: string;
  accessToken?: string;
  refreshToken?: string;
  user?: { id: string; email: string; firstName?: string };
  organizationId?: string;
  completedSteps: string[];
  slackOpened?: boolean;
  editorsConfigured?: string[];
  promptCopied?: boolean;
}

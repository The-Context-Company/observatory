export type Framework =
  | "nextjs-aisdk"
  | "claude-agent-sdk"
  | "langchain-ts"
  | "mastra"
  | "pi-mono"
  | "openclaw"
  | "custom-ts"
  | "langchain-python"
  | "crewai"
  | "agno"
  | "litellm"
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
    docsUrl: "https://docs.thecontext.company/frameworks/ai-sdk/setup",
    language: "typescript",
  },
  {
    id: "claude-agent-sdk",
    name: "Claude Agent SDK",
    description: "Instrument Claude Agent SDK agents",
    docsUrl: "https://docs.thecontext.company/frameworks/claude-agent-sdk",
    language: "typescript",
  },
  {
    id: "langchain-ts",
    name: "LangChain / LangGraph",
    description: "Instrument LangChain.js and LangGraph agents",
    docsUrl: "https://docs.thecontext.company/frameworks/langchain-langgraph",
    language: "typescript",
  },
  {
    id: "mastra",
    name: "Mastra",
    description: "Instrument Mastra agents and workflows",
    docsUrl: "https://docs.thecontext.company/frameworks/mastra/setup",
    language: "typescript",
  },
  {
    id: "pi-mono",
    name: "Pi-Mono",
    description: "Instrument Pi coding agent",
    docsUrl: "https://docs.thecontext.company/frameworks/pi-mono",
    language: "typescript",
  },
  {
    id: "openclaw",
    name: "OpenClaw",
    description: "Instrument OpenClaw agents",
    docsUrl: "https://docs.thecontext.company/frameworks/openclaw",
    language: "typescript",
  },
  {
    id: "custom-ts",
    name: "Custom",
    description: "Manual instrumentation for custom agents",
    docsUrl:
      "https://docs.thecontext.company/frameworks/custom-instrumentation/typescript/setup",
    language: "typescript",
  },
  {
    id: "langchain-python",
    name: "LangChain / LangGraph",
    description: "Instrument LangChain and LangGraph agents",
    docsUrl: "https://docs.thecontext.company/frameworks/langchain-langgraph",
    language: "python",
  },
  {
    id: "crewai",
    name: "CrewAI",
    description: "Instrument CrewAI agents",
    docsUrl: "https://docs.thecontext.company/frameworks/crewai",
    language: "python",
  },
  {
    id: "agno",
    name: "Agno",
    description: "Instrument Agno agents",
    docsUrl: "https://docs.thecontext.company/frameworks/agno",
    language: "python",
  },
  {
    id: "litellm",
    name: "LiteLLM",
    description: "Instrument LiteLLM proxy",
    docsUrl: "https://docs.thecontext.company/frameworks/litellm",
    language: "python",
  },
  {
    id: "custom-python",
    name: "Custom",
    description: "Manual instrumentation for custom agents",
    docsUrl:
      "https://docs.thecontext.company/frameworks/custom-instrumentation/python/setup",
    language: "python",
  },
];

/** Result of a pipeline step execution */
export interface StepResult {
  status: "completed" | "skipped" | "failed";
  message?: string;
}

/** A single step in the liftoff pipeline */
export interface Step {
  /** Human-readable step name for logging */
  name: string;
  /** Check if this step should execute (return false to skip for idempotency) */
  shouldRun(ctx: WizardContext): Promise<boolean>;
  /** Execute the step, mutating context as needed */
  run(ctx: WizardContext): Promise<StepResult>;
  /** Cleanup on Ctrl+C or error (optional) */
  cleanup?(ctx: WizardContext): Promise<void>;
}

export interface WizardContext {
  /** Root directory of the user's project */
  installDir: string;
  /** User-selected framework */
  framework?: Framework;
  /** Detected or user-selected package manager */
  packageManager?: PackageManager;
  /** Detected project language */
  language?: ProjectLanguage;
  /** TCC prod API key (provisioned by the keys step, written to .env[.local]) */
  apiKey?: string;
  /** Readonly MCP key (tcc_key_ prefix, provisioned for MCP/editor integrations) */
  readonlyKey?: string;
  /** Auth token from WorkOS OAuth (set by auth step) */
  accessToken?: string;
  /** Refresh token from WorkOS OAuth */
  refreshToken?: string;
  /** Authenticated user info */
  user?: { id: string; email: string; firstName?: string };
  /** Organization ID for key provisioning */
  organizationId?: string;
  /** Steps that have completed in this run (for idempotency tracking) */
  completedSteps: string[];
  /** Whether Slack workspace was connected (set by setup-slack step) */
  slackConnected?: boolean;
  /** Display names of MCP editors configured */
  editorsConfigured?: string[];
}

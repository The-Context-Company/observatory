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

export type Mode = "cloud" | "local";

export interface FrameworkInfo {
  id: Framework;
  name: string;
  description: string;
  docsUrl: string;
  language: "typescript" | "python";
  /** Whether this framework supports local mode */
  supportsLocalMode: boolean;
}

export const FRAMEWORKS: FrameworkInfo[] = [
  // TypeScript / JavaScript
  {
    id: "nextjs-aisdk",
    name: "Vercel AI SDK",
    description: "Instrument AI SDK calls in your Next.js app",
    docsUrl: "https://docs.thecontext.company/frameworks/ai-sdk/setup",
    language: "typescript",
    supportsLocalMode: true,
  },
  {
    id: "claude-agent-sdk",
    name: "Claude Agent SDK",
    description: "Instrument Claude Agent SDK agents",
    docsUrl: "https://docs.thecontext.company/frameworks/claude-agent-sdk",
    language: "typescript",
    supportsLocalMode: false,
  },
  {
    id: "langchain-ts",
    name: "LangChain / LangGraph",
    description: "Instrument LangChain.js and LangGraph agents",
    docsUrl: "https://docs.thecontext.company/frameworks/langchain-langgraph",
    language: "typescript",
    supportsLocalMode: false,
  },
  {
    id: "mastra",
    name: "Mastra",
    description: "Instrument Mastra agents and workflows",
    docsUrl: "https://docs.thecontext.company/frameworks/mastra/setup",
    language: "typescript",
    supportsLocalMode: false,
  },
  {
    id: "pi-mono",
    name: "Pi-Mono",
    description: "Instrument Pi coding agent",
    docsUrl: "https://docs.thecontext.company/frameworks/pi-mono",
    language: "typescript",
    supportsLocalMode: false,
  },
  {
    id: "openclaw",
    name: "OpenClaw",
    description: "Instrument OpenClaw agents",
    docsUrl: "https://docs.thecontext.company/frameworks/openclaw",
    language: "typescript",
    supportsLocalMode: false,
  },
  {
    id: "custom-ts",
    name: "Custom",
    description: "Manual instrumentation for custom agents",
    docsUrl: "https://docs.thecontext.company/frameworks/custom-instrumentation/typescript/setup",
    language: "typescript",
    supportsLocalMode: false,
  },
  // Python
  {
    id: "langchain-python",
    name: "LangChain / LangGraph",
    description: "Instrument LangChain and LangGraph agents",
    docsUrl: "https://docs.thecontext.company/frameworks/langchain-langgraph",
    language: "python",
    supportsLocalMode: false,
  },
  {
    id: "crewai",
    name: "CrewAI",
    description: "Instrument CrewAI agents",
    docsUrl: "https://docs.thecontext.company/frameworks/crewai",
    language: "python",
    supportsLocalMode: false,
  },
  {
    id: "agno",
    name: "Agno",
    description: "Instrument Agno agents",
    docsUrl: "https://docs.thecontext.company/frameworks/agno",
    language: "python",
    supportsLocalMode: false,
  },
  {
    id: "litellm",
    name: "LiteLLM",
    description: "Instrument LiteLLM proxy",
    docsUrl: "https://docs.thecontext.company/frameworks/litellm",
    language: "python",
    supportsLocalMode: false,
  },
  {
    id: "custom-python",
    name: "Custom",
    description: "Manual instrumentation for custom agents",
    docsUrl: "https://docs.thecontext.company/frameworks/custom-instrumentation/python/setup",
    language: "python",
    supportsLocalMode: false,
  },
];

/** Maps each framework to its required packages */
export const FRAMEWORK_PACKAGES: Record<Framework, string[]> = {
  "nextjs-aisdk": [
    "@contextcompany/otel",
    "@vercel/otel",
    "@opentelemetry/api",
  ],
  "claude-agent-sdk": ["@contextcompany/claude"],
  "langchain-ts": ["@contextcompany/langchain"],
  "mastra": ["@contextcompany/mastra"],
  "pi-mono": ["@contextcompany/pi"],
  "openclaw": ["@contextcompany/openclaw"],
  "custom-ts": ["@contextcompany/custom"],
  "langchain-python": ["contextcompany[langchain]"],
  "crewai": ["contextcompany[crewai]"],
  "agno": ["contextcompany[agno]"],
  "litellm": ["contextcompany[litellm]"],
  "custom-python": ["contextcompany"],
};

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
  /** Detected or user-selected framework */
  framework?: Framework;
  /** Detected package manager */
  packageManager?: PackageManager;
  /** Detected project language */
  language?: ProjectLanguage;
  /** Cloud (dashboard) or Local (no account needed) */
  mode: Mode;
  /** TCC API key (provisioned or provided via --key flag) */
  apiKey?: string;
  /** Readonly MCP key (tcc_key_ prefix, provisioned for MCP/editor integrations) */
  readonlyKey?: string;
  /** Whether the project uses TypeScript */
  typescript?: boolean;
  /** Whether the project has a src/ directory */
  srcDir?: boolean;
  /** Whether Next.js project uses the App Router */
  appDir?: boolean;
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
  /** Whether --key flag was provided (skips auth) */
  keyProvided: boolean;
  /** Git working tree is dirty */
  gitDirty?: boolean;
  /** Whether Slack workspace was connected (set by setup-slack step) */
  slackConnected?: boolean;
  /** File paths created by instrumentation */
  filesCreated?: string[];
  /** File paths modified by instrumentation */
  filesModified?: string[];
  /** Display names of MCP editors configured */
  editorsConfigured?: string[];
  /** Which metadata hooks were wired by AI instrumentation */
  metadataHooks?: {
    sessionId?: boolean;
    userId?: boolean;
    conversational?: boolean;
  };
}

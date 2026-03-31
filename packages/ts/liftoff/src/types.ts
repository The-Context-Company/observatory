export type Framework =
  | "nextjs-aisdk"
  | "claude-agent-sdk"
  | "langchain-ts"
  | "mastra"
  | "custom-ts";

export type PackageManager = "npm" | "yarn" | "pnpm" | "bun";

export type Mode = "cloud" | "local";

export interface FrameworkInfo {
  id: Framework;
  name: string;
  description: string;
  docsUrl: string;
  /** Whether this framework supports local mode */
  supportsLocalMode: boolean;
}

export const FRAMEWORKS: FrameworkInfo[] = [
  {
    id: "nextjs-aisdk",
    name: "Next.js + Vercel AI SDK",
    description: "Instrument AI SDK calls in your Next.js app",
    docsUrl: "https://docs.thecontext.company/frameworks/ai-sdk/setup",
    supportsLocalMode: true,
  },
  {
    id: "claude-agent-sdk",
    name: "Claude Agent SDK",
    description: "Instrument Claude Agent SDK agents",
    docsUrl: "https://docs.thecontext.company/frameworks/claude-agent-sdk",
    supportsLocalMode: false,
  },
  {
    id: "langchain-ts",
    name: "LangChain / LangGraph (TypeScript)",
    description: "Instrument LangChain.js and LangGraph agents",
    docsUrl:
      "https://docs.thecontext.company/frameworks/langchain-langgraph",
    supportsLocalMode: false,
  },
  {
    id: "mastra",
    name: "Mastra",
    description: "Instrument Mastra agents and workflows",
    docsUrl: "https://docs.thecontext.company/frameworks/mastra/setup",
    supportsLocalMode: false,
  },
  {
    id: "custom-ts",
    name: "Custom (TypeScript)",
    description: "Manual instrumentation for custom TypeScript agents",
    docsUrl: "https://docs.thecontext.company/",
    supportsLocalMode: false,
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
  /** Detected or user-selected framework */
  framework?: Framework;
  /** Detected package manager */
  packageManager?: PackageManager;
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
}

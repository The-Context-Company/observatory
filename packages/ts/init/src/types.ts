export type Framework =
  | "nextjs-aisdk"
  | "claude-agent-sdk"
  | "langchain-ts"
  | "mastra"
  | "custom-ts";

export type PackageManager = "npm" | "yarn" | "pnpm" | "bun";

export type Mode = "cloud" | "local";

export interface WizardContext {
  /** Detected or user-selected framework */
  framework: Framework;
  /** Detected package manager */
  packageManager: PackageManager;
  /** Cloud (dashboard) or Local (no account needed) */
  mode: Mode;
  /** TCC API key (only for cloud mode) */
  apiKey?: string;
  /** Root directory of the user's project */
  installDir: string;
  /** Whether the project uses TypeScript */
  typescript: boolean;
  /** Whether the project has a src/ directory */
  srcDir: boolean;
  /** Whether Next.js project uses the App Router */
  appDir: boolean;
}

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
    docsUrl: "https://docs.thecontext.company/frameworks/langchain-langgraph",
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

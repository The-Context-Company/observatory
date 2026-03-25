import fs from "node:fs";
import path from "node:path";
import type { Framework } from "../types.js";

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/**
 * Check if a package exists in the project's dependencies or devDependencies.
 */
function hasDep(pkg: PackageJson, name: string): boolean {
  return !!(pkg.dependencies?.[name] || pkg.devDependencies?.[name]);
}

/**
 * Check if any package matching a prefix exists in the project's dependencies.
 */
function hasDepPrefix(pkg: PackageJson, prefix: string): boolean {
  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
  };
  return Object.keys(allDeps).some((dep) => dep.startsWith(prefix));
}

/**
 * Auto-detect the framework used in the project from package.json.
 *
 * Detection order matters — more specific frameworks are checked first:
 * 1. Next.js + AI SDK (has `next` AND `ai` or `@ai-sdk/*`)
 * 2. Mastra (has `@mastra/core`)
 * 3. Claude Agent SDK (has `@anthropic-ai/claude-agent-sdk`)
 * 4. LangChain TS (has `@langchain/core` or `langchain`)
 * 5. Custom TS (fallback — has package.json but no recognized framework)
 */
export function detectFramework(installDir: string): Framework | null {
  const pkgPath = path.join(installDir, "package.json");

  if (!fs.existsSync(pkgPath)) {
    return null;
  }

  let pkg: PackageJson;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as PackageJson;
  } catch {
    return null;
  }

  // 1. Next.js + AI SDK
  if (
    hasDep(pkg, "next") &&
    (hasDep(pkg, "ai") || hasDepPrefix(pkg, "@ai-sdk/"))
  ) {
    return "nextjs-aisdk";
  }

  // 2. Mastra
  if (hasDep(pkg, "@mastra/core")) {
    return "mastra";
  }

  // 3. Claude Agent SDK
  if (hasDep(pkg, "@anthropic-ai/claude-agent-sdk")) {
    return "claude-agent-sdk";
  }

  // 4. LangChain TS
  if (hasDep(pkg, "@langchain/core") || hasDep(pkg, "langchain")) {
    return "langchain-ts";
  }

  // If we have a package.json but no recognized framework, return null
  // The wizard will let the user pick manually
  return null;
}

/**
 * Detect whether the project uses TypeScript (has tsconfig.json).
 */
export function detectTypeScript(installDir: string): boolean {
  return fs.existsSync(path.join(installDir, "tsconfig.json"));
}

/**
 * Detect whether the project has a src/ directory.
 */
export function detectSrcDir(installDir: string): boolean {
  return (
    fs.existsSync(path.join(installDir, "src")) &&
    fs.statSync(path.join(installDir, "src")).isDirectory()
  );
}

/**
 * Detect whether a Next.js project uses the App Router.
 * Checks for `app/` or `src/app/` directories.
 */
export function detectAppRouter(installDir: string): boolean {
  return (
    fs.existsSync(path.join(installDir, "app")) ||
    fs.existsSync(path.join(installDir, "src", "app"))
  );
}

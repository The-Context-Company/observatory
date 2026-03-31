import fs from "node:fs";
import path from "node:path";
import type { Framework, ProjectLanguage } from "../types.js";
import {
  parsePyprojectDeps,
  parseRequirementsTxt,
} from "./python-detection.js";

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/**
 * Check if a package exists in the project's dependencies
 * or devDependencies.
 */
function hasDep(pkg: PackageJson, name: string): boolean {
  return !!(
    pkg.dependencies?.[name] || pkg.devDependencies?.[name]
  );
}

/**
 * Check if any package matching a prefix exists in the
 * project's dependencies.
 */
function hasDepPrefix(pkg: PackageJson, prefix: string): boolean {
  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
  };
  return Object.keys(allDeps).some((dep) =>
    dep.startsWith(prefix),
  );
}

/**
 * Check if a Python dependency list contains a package.
 * Normalizes hyphens/underscores for comparison.
 */
function hasPythonDep(deps: string[], name: string): boolean {
  const normalized = name.toLowerCase().replace(/_/g, "-");
  return deps.some(
    (dep) => dep.toLowerCase().replace(/_/g, "-") === normalized,
  );
}

/**
 * Detect the project language based on manifest files.
 *
 * @returns "typescript" if package.json exists, "python" if
 *   pyproject.toml or requirements.txt exists, otherwise
 *   "unknown".
 */
export function detectLanguage(
  installDir: string,
): ProjectLanguage {
  if (fs.existsSync(path.join(installDir, "package.json"))) {
    return "typescript";
  }
  if (
    fs.existsSync(path.join(installDir, "pyproject.toml")) ||
    fs.existsSync(path.join(installDir, "requirements.txt"))
  ) {
    return "python";
  }
  return "unknown";
}

/**
 * Auto-detect the framework used in the project.
 *
 * Detection order matters -- more specific frameworks are
 * checked first. Only checks the current directory (no
 * traversal into subdirectories or node_modules).
 *
 * TS detection order:
 * 1. Next.js + AI SDK (has `next` AND `ai` or `@ai-sdk/*`)
 * 2. Pi-Mono (has `@mariozechner/pi-coding-agent`)
 * 3. OpenClaw (openclaw.json or `openclaw` dep)
 * 4. Mastra (has `@mastra/core`)
 * 5. Claude Agent SDK (has `@anthropic-ai/claude-agent-sdk`)
 * 6. LangChain TS (has `@langchain/core` or `langchain`)
 *
 * Python detection order:
 * 1. LangChain Python (langchain or langchain-core)
 * 2. CrewAI (crewai)
 * 3. Agno (agno)
 * 4. LiteLLM (litellm)
 *
 * @returns Detected framework or null if no match found.
 */
export function detectFramework(
  installDir: string,
): Framework | null {
  const pkgPath = path.join(installDir, "package.json");

  // Check package.json for TS frameworks
  if (fs.existsSync(pkgPath)) {
    let pkg: PackageJson;
    try {
      pkg = JSON.parse(
        fs.readFileSync(pkgPath, "utf-8"),
      ) as PackageJson;
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

    // 2. Pi-Mono
    if (hasDep(pkg, "@mariozechner/pi-coding-agent")) {
      return "pi-mono";
    }

    // 3. OpenClaw
    if (
      fs.existsSync(path.join(installDir, "openclaw.json")) ||
      hasDep(pkg, "openclaw")
    ) {
      return "openclaw";
    }

    // 4. Mastra
    if (hasDep(pkg, "@mastra/core")) {
      return "mastra";
    }

    // 5. Claude Agent SDK
    if (hasDep(pkg, "@anthropic-ai/claude-agent-sdk")) {
      return "claude-agent-sdk";
    }

    // 6. LangChain TS
    if (
      hasDep(pkg, "@langchain/core") ||
      hasDep(pkg, "langchain")
    ) {
      return "langchain-ts";
    }

    // Has package.json but no recognized framework
    return null;
  }

  // Check pyproject.toml/requirements.txt for Python frameworks
  const hasPyproject = fs.existsSync(
    path.join(installDir, "pyproject.toml"),
  );
  const hasRequirements = fs.existsSync(
    path.join(installDir, "requirements.txt"),
  );

  if (hasPyproject || hasRequirements) {
    const deps = [
      ...parsePyprojectDeps(installDir),
      ...parseRequirementsTxt(installDir),
    ];

    // 1. LangChain Python
    if (
      hasPythonDep(deps, "langchain") ||
      hasPythonDep(deps, "langchain-core")
    ) {
      return "langchain-python";
    }

    // 2. CrewAI
    if (hasPythonDep(deps, "crewai")) {
      return "crewai";
    }

    // 3. Agno
    if (hasPythonDep(deps, "agno")) {
      return "agno";
    }

    // 4. LiteLLM
    if (hasPythonDep(deps, "litellm")) {
      return "litellm";
    }

    // Has Python files but no recognized framework
    return null;
  }

  // No manifest files found
  return null;
}

/**
 * Detect whether the project uses TypeScript (has
 * tsconfig.json).
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

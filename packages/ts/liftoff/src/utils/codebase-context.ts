import fs from "node:fs";
import path from "node:path";
import type {
  Framework,
  ProjectLanguage,
  WizardContext,
} from "../types.js";

const MAX_FILE_LINES = 100;
const MAX_TOTAL_CHARS = 8000;

/** Directories to skip when scanning for files */
const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  "__pycache__",
  ".git",
  "dist",
  ".venv",
  "venv",
  ".tox",
]);

/** Directories to scan for content-matching files */
const SCAN_DIRS = ["src", "app", "lib", "api", "routes", "pages"];

/** Maximum directory depth for recursive file scanning */
const MAX_SCAN_DEPTH = 3;

/**
 * A file collected as context for the AI instrumentation endpoint.
 */
export interface ContextFile {
  /** Path relative to installDir */
  path: string;
  /** File content, truncated to MAX_FILE_LINES */
  content: string;
  /** Role of this file in the project */
  role:
    | "entry-point"
    | "config"
    | "auth-pattern"
    | "framework-config"
    | "instrumentation";
}

/**
 * Codebase context sent to the /api/cli/instrument endpoint.
 */
export interface CodebaseContext {
  framework: Framework;
  language: ProjectLanguage;
  typescript: boolean;
  srcDir: boolean;
  files: ContextFile[];
  existingInstrumentation: boolean;
  packageJson?: {
    dependencies: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
}

/**
 * Collect relevant project files for the AI instrumentation endpoint.
 *
 * Respects an 8KB total character budget and truncates individual
 * files to 100 lines. Framework-specific files are collected based
 * on the detected framework, plus common metadata patterns.
 */
export function collectCodebaseContext(
  ctx: WizardContext,
): CodebaseContext {
  const files: ContextFile[] = [];
  let totalChars = 0;

  const addFile = (relPath: string, role: ContextFile["role"]): void => {
    const absPath = path.join(ctx.installDir, relPath);
    if (!fs.existsSync(absPath)) return;

    let stat;
    try {
      stat = fs.statSync(absPath);
    } catch {
      return;
    }
    if (!stat.isFile()) return;

    const raw = fs.readFileSync(absPath, "utf-8");
    const truncated = raw.split("\n").slice(0, MAX_FILE_LINES).join("\n");
    if (totalChars + truncated.length > MAX_TOTAL_CHARS) return;

    totalChars += truncated.length;
    files.push({ path: relPath, content: truncated, role });
  };

  // --- Package manifest ---
  const language = ctx.language ?? "unknown";
  let packageJson:
    | {
        dependencies: Record<string, string>;
        devDependencies?: Record<string, string>;
      }
    | undefined;

  if (language !== "python") {
    const pkgPath = path.join(ctx.installDir, "package.json");
    if (fs.existsSync(pkgPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
        packageJson = {
          dependencies: raw.dependencies ?? {},
          devDependencies: raw.devDependencies,
        };
        // Add a slimmed-down version to files
        const slim = JSON.stringify(packageJson, null, 2);
        if (totalChars + slim.length <= MAX_TOTAL_CHARS) {
          totalChars += slim.length;
          files.push({
            path: "package.json",
            content: slim,
            role: "config",
          });
        }
      } catch {
        // Malformed package.json -- skip
      }
    }
  } else {
    addFile("pyproject.toml", "config");
    addFile("requirements.txt", "config");
  }

  // --- Framework-specific collection ---
  switch (ctx.framework) {
    case "nextjs-aisdk": {
      addFile("next.config.js", "config");
      addFile("next.config.mjs", "config");
      addFile("next.config.ts", "config");
      addFile("src/instrumentation.ts", "instrumentation");
      addFile("instrumentation.ts", "instrumentation");
      // Find API route files containing generateText or streamText
      const aiSdkFiles = findFilesContaining(
        ctx.installDir,
        /\b(generateText|streamText)\b/,
        2,
      );
      for (const f of aiSdkFiles) {
        addFile(f, "framework-config");
      }
      break;
    }

    case "claude-agent-sdk": {
      const claudeFiles = findFilesContaining(
        ctx.installDir,
        /@anthropic-ai\/claude-agent-sdk/,
        2,
      );
      for (const f of claudeFiles) {
        addFile(f, "entry-point");
      }
      break;
    }

    case "langchain-ts": {
      const lcFiles = findFilesContaining(
        ctx.installDir,
        /(@langchain\/core|langchain)/,
        2,
      );
      for (const f of lcFiles) {
        addFile(f, "entry-point");
      }
      break;
    }

    case "mastra": {
      const mastraFiles = findFilesContaining(
        ctx.installDir,
        /new\s+Mastra\s*\(/,
        1,
      );
      for (const f of mastraFiles) {
        addFile(f, "framework-config");
      }
      break;
    }

    case "pi-mono": {
      const piFiles = findFilesContaining(
        ctx.installDir,
        /@anthropic-ai\/pi-mono/,
        2,
      );
      for (const f of piFiles) {
        addFile(f, "entry-point");
      }
      break;
    }

    case "openclaw": {
      const ocFiles = findFilesContaining(
        ctx.installDir,
        /openclaw/,
        2,
      );
      for (const f of ocFiles) {
        addFile(f, "entry-point");
      }
      break;
    }

    case "custom-ts": {
      // Try main entry from package.json
      if (packageJson) {
        const pkgPath = path.join(ctx.installDir, "package.json");
        if (fs.existsSync(pkgPath)) {
          try {
            const raw = JSON.parse(
              fs.readFileSync(pkgPath, "utf-8"),
            );
            if (raw.main) {
              addFile(raw.main, "entry-point");
            }
          } catch {
            // skip
          }
        }
      }
      break;
    }

    case "langchain-python":
    case "crewai":
    case "agno":
    case "litellm":
    case "custom-python": {
      addFile("main.py", "entry-point");
      addFile("app.py", "entry-point");
      addFile("src/main.py", "entry-point");
      addFile("pyproject.toml", "config");
      break;
    }
  }

  // --- Metadata detection (auth/session patterns) ---
  const authFiles = findFilesContaining(
    ctx.installDir,
    /\b(session|userId|auth)\b/,
    2,
  );
  for (const f of authFiles) {
    addFile(f, "auth-pattern");
  }

  // --- Existing instrumentation detection ---
  const existingInstrumentation = hasExistingInstrumentation(
    ctx.installDir,
  );

  return {
    framework: ctx.framework!,
    language,
    typescript: ctx.typescript ?? false,
    srcDir: ctx.srcDir ?? false,
    files,
    existingInstrumentation,
    packageJson,
  };
}

/**
 * Recursively scan common directories for files matching a content pattern.
 * Keeps the scan shallow (max 3 levels deep) for speed.
 *
 * @returns Relative paths (to installDir) of matching files, up to `limit`.
 */
function findFilesContaining(
  installDir: string,
  pattern: RegExp,
  limit: number,
): string[] {
  const results: string[] = [];

  const scanDir = (dir: string, depth: number): void => {
    if (depth > MAX_SCAN_DEPTH || results.length >= limit) return;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (results.length >= limit) return;

      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        scanDir(path.join(dir, entry.name), depth + 1);
      } else if (entry.isFile() && isSourceFile(entry.name)) {
        const absPath = path.join(dir, entry.name);
        try {
          const content = fs.readFileSync(absPath, "utf-8");
          if (pattern.test(content)) {
            results.push(path.relative(installDir, absPath));
          }
        } catch {
          // Unreadable file -- skip
        }
      }
    }
  };

  // Scan common directories
  for (const subDir of SCAN_DIRS) {
    const fullDir = path.join(installDir, subDir);
    if (fs.existsSync(fullDir)) {
      scanDir(fullDir, 1);
    }
  }

  // Also scan root-level files (depth 0)
  try {
    const rootEntries = fs.readdirSync(installDir, {
      withFileTypes: true,
    });
    for (const entry of rootEntries) {
      if (results.length >= limit) break;
      if (entry.isFile() && isSourceFile(entry.name)) {
        const absPath = path.join(installDir, entry.name);
        try {
          const content = fs.readFileSync(absPath, "utf-8");
          if (pattern.test(content)) {
            results.push(entry.name);
          }
        } catch {
          // skip
        }
      }
    }
  } catch {
    // skip
  }

  return results;
}

/**
 * Check if a filename looks like a source file worth scanning.
 */
function isSourceFile(name: string): boolean {
  return /\.(ts|tsx|js|jsx|mjs|py)$/.test(name);
}

/**
 * Check for existing TCC instrumentation files.
 */
function hasExistingInstrumentation(installDir: string): boolean {
  const candidates = [
    "tcc-instrumentation.ts",
    "tcc-instrumentation.js",
    "src/tcc-instrumentation.ts",
    "src/tcc-instrumentation.js",
    "tcc_instrumentation.py",
    "src/tcc_instrumentation.py",
    "instrumentation.ts",
    "instrumentation.js",
  ];

  for (const candidate of candidates) {
    const absPath = path.join(installDir, candidate);
    if (fs.existsSync(absPath)) {
      try {
        const content = fs.readFileSync(absPath, "utf-8");
        if (
          content.includes("contextcompany") ||
          content.includes("tcc")
        ) {
          return true;
        }
      } catch {
        // skip
      }
    }
  }

  return false;
}

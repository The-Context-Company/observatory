import fs from "node:fs";
import path from "node:path";
import type { WizardContext } from "../types.js";
import type { FileChange } from "./diff-display.js";

/** Directories to skip when scanning for files */
const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  "__pycache__",
  ".git",
  "dist",
  "build",
  ".venv",
  "venv",
]);

/** Source file extensions to scan */
const SOURCE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
]);

/**
 * Detect and generate fixes for framework-specific gotchas.
 *
 * Returns FileChange objects that the instrument step shows as
 * colored diffs for the user to accept or reject per file.
 *
 * Currently handles:
 * - FIX-01: experimental_telemetry for Vercel AI SDK generateText/streamText calls
 * - FIX-02: instrumentationHook for Next.js <15 in next.config
 * - FIX-03: tcc.conversational metadata -- handled by templates (D-06)
 * - FIX-04: sessionId/runId patterns -- handled by AI path and templates (D-07)
 */
export function detectGotchaFixes(ctx: WizardContext): FileChange[] {
  const changes: FileChange[] = [];

  if (ctx.framework !== "nextjs-aisdk") {
    return changes;
  }

  // FIX-01: experimental_telemetry for Vercel AI SDK
  const telemetryFixes = fixExperimentalTelemetry(ctx.installDir);
  changes.push(...telemetryFixes);

  // FIX-02: instrumentationHook for Next.js <15
  const hookFix = fixInstrumentationHook(ctx.installDir);
  if (hookFix) {
    changes.push(hookFix);
  }

  return changes;
}

/**
 * FIX-01: Find generateText/streamText calls missing experimental_telemetry
 * and generate patches to add it.
 */
function fixExperimentalTelemetry(installDir: string): FileChange[] {
  const changes: FileChange[] = [];

  // Scan common source directories for AI SDK usage
  const scanDirs = ["src/app", "app", "src", "pages"];
  const matchingFiles = findFilesWithPattern(
    installDir,
    "generateText|streamText",
    [...SOURCE_EXTENSIONS],
    3,
    scanDirs,
  );

  for (const absPath of matchingFiles) {
    const oldContent = fs.readFileSync(absPath, "utf-8");

    // Skip if already has experimental_telemetry
    if (oldContent.includes("experimental_telemetry")) {
      continue;
    }

    // Insert experimental_telemetry after the opening { of generateText/streamText calls
    const pattern =
      /((?:generateText|streamText)\s*\(\s*\{)/g;
    const newContent = oldContent.replace(
      pattern,
      `$1\n    experimental_telemetry: { isEnabled: true },`,
    );

    // Only add if we actually changed something
    if (newContent !== oldContent) {
      const relPath = path.relative(installDir, absPath);
      changes.push({
        filePath: relPath,
        oldContent,
        newContent,
        description:
          "Enable experimental_telemetry for AI SDK calls (required for observability)",
      });
    }
  }

  return changes;
}

/**
 * FIX-02: Add instrumentationHook: true to next.config for Next.js <15.
 *
 * Next.js 15+ enables the instrumentation hook by default,
 * so this fix is only applied for versions <15.
 */
function fixInstrumentationHook(
  installDir: string,
): FileChange | null {
  const nextVersion = getNextMajorVersion(installDir);

  // Only apply for Next.js <15 (15+ has instrumentation hook enabled by default)
  if (nextVersion === null || nextVersion >= 15) {
    return null;
  }

  // Find next.config file
  const configNames = [
    "next.config.js",
    "next.config.mjs",
    "next.config.ts",
  ];
  let configPath: string | null = null;
  let configRelPath: string | null = null;

  for (const name of configNames) {
    const abs = path.join(installDir, name);
    if (fs.existsSync(abs)) {
      configPath = abs;
      configRelPath = name;
      break;
    }
  }

  if (!configPath || !configRelPath) {
    return null;
  }

  const oldContent = fs.readFileSync(configPath, "utf-8");

  // Skip if already has instrumentationHook
  if (oldContent.includes("instrumentationHook")) {
    return null;
  }

  // Find the config object opening pattern
  const patterns = [
    /(module\.exports\s*=\s*\{)/,
    /(export\s+default\s*\{)/,
    /(const\s+nextConfig\s*=\s*\{)/,
  ];

  let newContent = oldContent;
  let matched = false;

  for (const pattern of patterns) {
    if (pattern.test(newContent)) {
      newContent = newContent.replace(
        pattern,
        `$1\n  experimental: { instrumentationHook: true },`,
      );
      matched = true;
      break;
    }
  }

  if (!matched || newContent === oldContent) {
    return null;
  }

  return {
    filePath: configRelPath,
    oldContent,
    newContent,
    description:
      "Enable instrumentationHook in next.config (required for Next.js <15)",
  };
}

/**
 * Read package.json and extract the major version of Next.js.
 *
 * @returns The major version number, or null if Next.js is not found.
 */
export function getNextMajorVersion(
  installDir: string,
): number | null {
  const pkgPath = path.join(installDir, "package.json");
  if (!fs.existsSync(pkgPath)) {
    return null;
  }

  try {
    const raw = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    const version =
      raw.dependencies?.next ?? raw.devDependencies?.next;
    if (!version) return null;

    // Extract major version from semver string (handles ^14.0.0, ~14.1.0, 14.0.0, >=14, etc.)
    const match = version.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  } catch {
    return null;
  }
}

/**
 * Recursively find files whose content matches a string pattern.
 *
 * @param dir - Base directory to search from
 * @param pattern - String pattern to search for (used as RegExp source)
 * @param extensions - File extensions to include (e.g., [".ts", ".tsx"])
 * @param maxDepth - Maximum directory depth to traverse
 * @param scanDirs - Subdirectories to scan (relative to dir)
 * @returns Absolute paths of matching files
 */
function findFilesWithPattern(
  dir: string,
  pattern: string,
  extensions: string[],
  maxDepth: number,
  scanDirs: string[],
): string[] {
  const results: string[] = [];
  const regex = new RegExp(pattern);
  const extSet = new Set(extensions);

  const scan = (currentDir: string, depth: number): void => {
    if (depth > maxDepth) return;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        scan(path.join(currentDir, entry.name), depth + 1);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (!extSet.has(ext)) continue;

        const absPath = path.join(currentDir, entry.name);
        try {
          const content = fs.readFileSync(absPath, "utf-8");
          if (regex.test(content)) {
            results.push(absPath);
          }
        } catch {
          // Unreadable file -- skip
        }
      }
    }
  };

  for (const subDir of scanDirs) {
    const fullDir = path.join(dir, subDir);
    if (fs.existsSync(fullDir)) {
      scan(fullDir, 1);
    }
  }

  return results;
}

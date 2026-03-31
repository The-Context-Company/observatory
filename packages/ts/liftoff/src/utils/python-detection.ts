import fs from "node:fs";
import path from "node:path";

/**
 * Normalize a Python package name for comparison.
 * Lowercases, replaces underscores with hyphens, strips
 * version specifiers.
 */
function normalizePyPkg(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
    .split(/[>=<!~;]/)[0]
    .trim();
}

/**
 * Parse dependencies from a pyproject.toml file.
 *
 * Reads the `[project]` section's `dependencies` array and
 * `[project.optional-dependencies]` sections using regex
 * (no TOML library required).
 *
 * @returns Normalized lowercase package names, or empty array
 *   if file not found or parse fails.
 */
export function parsePyprojectDeps(installDir: string): string[] {
  const filePath = path.join(installDir, "pyproject.toml");

  if (!fs.existsSync(filePath)) {
    return [];
  }

  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    return [];
  }

  const deps: string[] = [];

  // Match dependencies array in [project] section
  const projMatch = content.match(
    /\[project\][\s\S]*?dependencies\s*=\s*\[([\s\S]*?)\]/,
  );
  if (projMatch) {
    const items = projMatch[1].match(/"([^"]+)"|'([^']+)'/g);
    if (items) {
      for (const item of items) {
        const cleaned = item.replace(/["']/g, "");
        const name = normalizePyPkg(cleaned);
        if (name) {
          deps.push(name);
        }
      }
    }
  }

  // Match optional-dependencies sections
  const optMatch = content.matchAll(
    /\[project\.optional-dependencies\.\w+\]\s*\n([\s\S]*?)(?=\n\[|\n*$)/g,
  );
  for (const m of optMatch) {
    const items = m[1].match(/"([^"]+)"|'([^']+)'/g);
    if (items) {
      for (const item of items) {
        const cleaned = item.replace(/["']/g, "");
        const name = normalizePyPkg(cleaned);
        if (name) {
          deps.push(name);
        }
      }
    }
  }

  // Also match inline optional-dependencies format:
  // [project.optional-dependencies]
  // extra = ["pkg1", "pkg2"]
  const inlineOptMatch = content.match(
    /\[project\.optional-dependencies\]\s*\n([\s\S]*?)(?=\n\[|$)/,
  );
  if (inlineOptMatch) {
    const arrays = inlineOptMatch[1].matchAll(
      /\w+\s*=\s*\[([\s\S]*?)\]/g,
    );
    for (const arr of arrays) {
      const items = arr[1].match(/"([^"]+)"|'([^']+)'/g);
      if (items) {
        for (const item of items) {
          const cleaned = item.replace(/["']/g, "");
          const name = normalizePyPkg(cleaned);
          if (name) {
            deps.push(name);
          }
        }
      }
    }
  }

  return deps;
}

/**
 * Parse dependencies from a requirements.txt file.
 *
 * Splits by newline, filters out comments and flags,
 * strips version specifiers, normalizes to lowercase.
 *
 * @returns Normalized lowercase package names, or empty array
 *   if file not found.
 */
export function parseRequirementsTxt(
  installDir: string,
): string[] {
  const filePath = path.join(installDir, "requirements.txt");

  if (!fs.existsSync(filePath)) {
    return [];
  }

  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    return [];
  }

  const deps: string[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines, comments, and flags
    if (
      !trimmed ||
      trimmed.startsWith("#") ||
      trimmed.startsWith("-r") ||
      trimmed.startsWith("-e") ||
      trimmed.startsWith("-i") ||
      trimmed.startsWith("-f") ||
      trimmed.startsWith("--")
    ) {
      continue;
    }

    const name = normalizePyPkg(trimmed);
    if (name) {
      deps.push(name);
    }
  }

  return deps;
}

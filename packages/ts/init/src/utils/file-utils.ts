import fs from "node:fs";
import path from "node:path";

/**
 * Check if a file exists.
 */
export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

/**
 * Read a file's content. Returns null if the file doesn't exist.
 */
export function readFile(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

/**
 * Write content to a file, creating parent directories if needed.
 */
export function writeFile(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content, "utf-8");
}

/**
 * Read and parse the project's package.json.
 * Returns null if it doesn't exist or is invalid.
 */
export function readPackageJson(
  installDir: string,
): Record<string, unknown> | null {
  const content = readFile(path.join(installDir, "package.json"));
  if (!content) return null;
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Find the Next.js root layout file.
 * Checks common locations in order:
 *   - src/app/layout.tsx
 *   - src/app/layout.jsx
 *   - src/app/layout.js
 *   - app/layout.tsx
 *   - app/layout.jsx
 *   - app/layout.js
 */
export function findLayoutFile(installDir: string): string | null {
  const candidates = [
    "src/app/layout.tsx",
    "src/app/layout.jsx",
    "src/app/layout.js",
    "app/layout.tsx",
    "app/layout.jsx",
    "app/layout.js",
  ];

  for (const candidate of candidates) {
    const fullPath = path.join(installDir, candidate);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  return null;
}

/**
 * Find the instrumentation file in a Next.js project.
 * Checks common locations:
 *   - src/instrumentation.ts
 *   - src/instrumentation.js
 *   - instrumentation.ts
 *   - instrumentation.js
 */
export function findInstrumentationFile(installDir: string): string | null {
  const candidates = [
    "src/instrumentation.ts",
    "src/instrumentation.js",
    "instrumentation.ts",
    "instrumentation.js",
  ];

  for (const candidate of candidates) {
    const fullPath = path.join(installDir, candidate);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  return null;
}

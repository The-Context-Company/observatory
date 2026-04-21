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
  installDir: string
): Record<string, unknown> | null {
  const content = readFile(path.join(installDir, "package.json"));
  if (!content) return null;
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

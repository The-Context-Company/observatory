import fs from "node:fs";
import path from "node:path";
import { fileExists, readFile, writeFile } from "./file-utils.js";

/**
 * Get the appropriate env filename for a framework.
 * Next.js uses .env.local; other frameworks use .env
 */
export function getEnvFilename(isNextJs: boolean): string {
  return isNextJs ? ".env.local" : ".env";
}

/**
 * Ensure the env file exists. Creates it if it doesn't.
 * Returns the full path to the env file.
 */
export function ensureEnvFile(
  installDir: string,
  isNextJs: boolean,
): string {
  const filename = getEnvFilename(isNextJs);
  const envPath = path.join(installDir, filename);

  if (!fileExists(envPath)) {
    writeFile(envPath, "");
  }

  return envPath;
}

/**
 * Check if an environment variable key exists in the env file.
 */
export function hasEnvVariable(envPath: string, key: string): boolean {
  const content = readFile(envPath);
  if (!content) return false;

  // Match KEY= at start of line (with optional quotes around value)
  const regex = new RegExp(`^${escapeRegex(key)}=`, "m");
  return regex.test(content);
}

/**
 * Add or update an environment variable in the env file.
 * If the key already exists, it will be updated.
 */
export function setEnvVariable(
  envPath: string,
  key: string,
  value: string,
): void {
  let content = readFile(envPath) || "";

  const regex = new RegExp(`^${escapeRegex(key)}=.*$`, "m");

  if (regex.test(content)) {
    // Update existing
    content = content.replace(regex, `${key}=${value}`);
  } else {
    // Append new variable
    if (content.length > 0 && !content.endsWith("\n")) {
      content += "\n";
    }
    content += `${key}=${value}\n`;
  }

  writeFile(envPath, content);
}

/**
 * Ensure the env file is listed in .gitignore.
 */
export function ensureGitignore(
  installDir: string,
  envFilename: string,
): void {
  const gitignorePath = path.join(installDir, ".gitignore");

  let content = "";
  if (fs.existsSync(gitignorePath)) {
    content = fs.readFileSync(gitignorePath, "utf-8");
  }

  // Check if the env file is already in .gitignore
  const lines = content.split("\n").map((l) => l.trim());
  if (lines.includes(envFilename)) {
    return; // Already in .gitignore
  }

  // Append the env file to .gitignore
  if (content.length > 0 && !content.endsWith("\n")) {
    content += "\n";
  }
  content += `\n# Environment variables\n${envFilename}\n`;

  fs.writeFileSync(gitignorePath, content, "utf-8");
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

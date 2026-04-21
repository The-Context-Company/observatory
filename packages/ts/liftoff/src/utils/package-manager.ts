import fs from "node:fs";
import path from "node:path";
import type { PackageManager } from "../types.js";

interface LockfileEntry {
  file: string;
  pm: PackageManager;
}

const TS_LOCKFILES: LockfileEntry[] = [
  { file: "bun.lockb", pm: "bun" },
  { file: "bun.lock", pm: "bun" },
  { file: "pnpm-lock.yaml", pm: "pnpm" },
  { file: "yarn.lock", pm: "yarn" },
  { file: "package-lock.json", pm: "npm" },
];

const PYTHON_LOCKFILES: LockfileEntry[] = [
  { file: "uv.lock", pm: "uv" },
  { file: "poetry.lock", pm: "poetry" },
];

/**
 * Detect the package manager used in the project by checking for lockfiles.
 * Language-aware: checks Python lockfiles for Python projects, TS lockfiles for TS projects.
 * Falls back to npm (TS) or pip (Python) if no lockfile is found.
 */
/**
 * Check current directory for a lockfile.
 */
function findLockfileInDir(
  dir: string,
  lockfiles: LockfileEntry[]
): PackageManager | null {
  for (const { file, pm } of lockfiles) {
    if (fs.existsSync(path.join(dir, file))) {
      return pm;
    }
  }
  return null;
}

/**
 * Walk up directories until git root, checking for lockfiles or packageManager field.
 * Stops at .git boundary to avoid escaping the project.
 */
function detectFromAncestors(
  startDir: string,
  lockfiles: LockfileEntry[]
): PackageManager | null {
  let dir = path.resolve(startDir);
  const root = path.parse(dir).root;

  // Skip the starting dir (already checked)
  dir = path.dirname(dir);

  while (dir !== root) {
    // Check lockfiles
    for (const { file, pm } of lockfiles) {
      if (fs.existsSync(path.join(dir, file))) {
        return pm;
      }
    }

    // Check package.json packageManager field
    const pkgPath = path.join(dir, "package.json");
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as {
          packageManager?: string;
        };
        if (typeof pkg.packageManager === "string") {
          const name = pkg.packageManager.split("@")[0];
          if (
            name === "pnpm" ||
            name === "yarn" ||
            name === "bun" ||
            name === "npm"
          ) {
            return name;
          }
        }
      } catch {
        // ignore parse errors
      }
    }

    // Stop at git root — don't escape the project
    if (fs.existsSync(path.join(dir, ".git"))) break;

    dir = path.dirname(dir);
  }
  return null;
}

export function detectPackageManager(
  installDir: string,
  language: "typescript" | "python" | "unknown" = "unknown"
): PackageManager | null {
  if (language === "python") {
    return (
      findLockfileInDir(installDir, PYTHON_LOCKFILES) ??
      detectFromAncestors(installDir, PYTHON_LOCKFILES) ??
      "pip"
    );
  }

  // 1. Check current directory for lockfile
  const fromLockfile = findLockfileInDir(installDir, TS_LOCKFILES);
  if (fromLockfile) return fromLockfile;

  // 2. Walk up to git root, checking lockfiles and packageManager field
  const fromAncestor = detectFromAncestors(installDir, TS_LOCKFILES);
  if (fromAncestor) return fromAncestor;

  // 3. Return null — caller should ask the user
  return null;
}

/**
 * Get the dev run command for a given package manager.
 */
export function getRunDevCommand(pm: PackageManager): string {
  switch (pm) {
    case "bun":
      return "bun dev";
    case "pnpm":
      return "pnpm dev";
    case "yarn":
      return "yarn dev";
    case "npm":
      return "npm run dev";
    case "pip":
      return "python main.py";
    case "poetry":
      return "poetry run python main.py";
    case "uv":
      return "uv run python main.py";
  }
}

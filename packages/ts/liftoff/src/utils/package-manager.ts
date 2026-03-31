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
export function detectPackageManager(installDir: string, language: "typescript" | "python" | "unknown" = "unknown"): PackageManager {
  if (language === "python") {
    for (const { file, pm } of PYTHON_LOCKFILES) {
      if (fs.existsSync(path.join(installDir, file))) {
        return pm;
      }
    }
    return "pip";
  }

  for (const { file, pm } of TS_LOCKFILES) {
    if (fs.existsSync(path.join(installDir, file))) {
      return pm;
    }
  }
  return "npm";
}

/**
 * Get the install command for a given package manager and list of packages.
 */
export function getInstallCommand(
  pm: PackageManager,
  packages: string[],
): string {
  const pkgs = packages.join(" ");
  switch (pm) {
    case "bun":
      return `bun add ${pkgs}`;
    case "pnpm":
      return `pnpm add ${pkgs}`;
    case "yarn":
      return `yarn add ${pkgs}`;
    case "npm":
      return `npm install ${pkgs}`;
    case "pip":
      return `pip install ${pkgs}`;
    case "poetry":
      return `poetry add ${pkgs}`;
    case "uv":
      return `uv add ${pkgs}`;
  }
}

/**
 * Check if a package is already installed in the project's node_modules.
 */
export function isPackageInstalled(
  installDir: string,
  packageName: string,
): boolean {
  try {
    const pkgPath = path.join(installDir, "package.json");
    if (!fs.existsSync(pkgPath)) return false;
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    return !!(
      pkg.dependencies?.[packageName] ||
      pkg.devDependencies?.[packageName]
    );
  } catch {
    return false;
  }
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

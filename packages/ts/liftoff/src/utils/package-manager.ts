import fs from "node:fs";
import path from "node:path";
import type { PackageManager } from "../types.js";

interface LockfileEntry {
  file: string;
  pm: PackageManager;
}

const LOCKFILES: LockfileEntry[] = [
  { file: "bun.lockb", pm: "bun" },
  { file: "bun.lock", pm: "bun" },
  { file: "pnpm-lock.yaml", pm: "pnpm" },
  { file: "yarn.lock", pm: "yarn" },
  { file: "package-lock.json", pm: "npm" },
];

/**
 * Detect the package manager used in the project by checking for lockfiles.
 * Falls back to npm if no lockfile is found.
 */
export function detectPackageManager(installDir: string): PackageManager {
  for (const { file, pm } of LOCKFILES) {
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
  }
}

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type {
  PackageManager,
  ProjectLanguage,
} from "../types.js";

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
 * Detect the package manager used in the project by checking
 * for lockfiles.
 *
 * For TypeScript projects, checks for bun.lockb, bun.lock,
 * pnpm-lock.yaml, yarn.lock, and package-lock.json. Falls
 * back to npm.
 *
 * For Python projects, checks for uv.lock and poetry.lock.
 * Falls back to pip.
 *
 * @param installDir - Root directory of the project
 * @param language - Detected project language
 * @returns The detected package manager
 */
export function detectPackageManager(
  installDir: string,
  language: ProjectLanguage,
): PackageManager {
  if (language === "typescript") {
    for (const { file, pm } of TS_LOCKFILES) {
      if (fs.existsSync(path.join(installDir, file))) {
        return pm;
      }
    }
    return "npm";
  }

  if (language === "python") {
    for (const { file, pm } of PYTHON_LOCKFILES) {
      if (fs.existsSync(path.join(installDir, file))) {
        return pm;
      }
    }
    return "pip";
  }

  // Unknown language: try TS lockfiles first, then Python
  for (const { file, pm } of TS_LOCKFILES) {
    if (fs.existsSync(path.join(installDir, file))) {
      return pm;
    }
  }
  for (const { file, pm } of PYTHON_LOCKFILES) {
    if (fs.existsSync(path.join(installDir, file))) {
      return pm;
    }
  }
  return "npm";
}

/**
 * Get the install command for a given package manager and
 * list of packages.
 *
 * Python package names are quoted to handle bracket extras
 * safely (e.g. `contextcompany[langchain]`).
 *
 * @param pm - The package manager to use
 * @param packages - List of package names to install
 * @returns The full install command string
 */
export function getInstallCommand(
  pm: PackageManager,
  packages: string[],
): string {
  switch (pm) {
    case "bun":
      return `bun add ${packages.join(" ")}`;
    case "pnpm":
      return `pnpm add ${packages.join(" ")}`;
    case "yarn":
      return `yarn add ${packages.join(" ")}`;
    case "npm":
      return `npm install ${packages.join(" ")}`;
    case "pip": {
      const quoted = packages.map((p) => `"${p}"`).join(" ");
      return `pip install ${quoted}`;
    }
    case "poetry": {
      const quoted = packages.map((p) => `"${p}"`).join(" ");
      return `poetry add ${quoted}`;
    }
    case "uv": {
      const quoted = packages.map((p) => `"${p}"`).join(" ");
      return `uv pip install ${quoted}`;
    }
  }
}

/**
 * Check if a package is already installed in the project.
 *
 * For TypeScript, checks if the package directory exists in
 * node_modules. For Python, uses `pip show` to check
 * site-packages.
 *
 * @param installDir - Root directory of the project
 * @param packageName - Package name to check
 * @param language - Project language
 * @returns true if the package is installed
 */
export function isPackageInstalled(
  installDir: string,
  packageName: string,
  language: ProjectLanguage,
): boolean {
  if (language === "typescript" || language === "unknown") {
    // Handle scoped packages (e.g. @contextcompany/otel)
    const parts = packageName.startsWith("@")
      ? [packageName.split("/").slice(0, 2).join("/")]
      : [packageName];
    const modPath = path.join(
      installDir,
      "node_modules",
      ...parts,
    );
    return fs.existsSync(modPath);
  }

  if (language === "python") {
    // Strip extras for pip show (e.g. contextcompany[langchain]
    // -> contextcompany)
    const basePkg = packageName.split("[")[0];
    try {
      execSync(`pip show ${basePkg}`, {
        stdio: ["pipe", "pipe", "pipe"],
      });
      return true;
    } catch {
      return false;
    }
  }

  return false;
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
    case "poetry":
    case "uv":
      return "python main.py";
  }
}

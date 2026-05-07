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

// Returns null when no lockfile is present so the caller can prompt
// instead of silently picking a default the user never asked for.
export function detectPackageManager(
  installDir: string,
  language: ProjectLanguage,
): PackageManager | null {
  if (language === "typescript") {
    for (const { file, pm } of TS_LOCKFILES) {
      if (fs.existsSync(path.join(installDir, file))) {
        return pm;
      }
    }
    return null;
  }

  if (language === "python") {
    for (const { file, pm } of PYTHON_LOCKFILES) {
      if (fs.existsSync(path.join(installDir, file))) {
        return pm;
      }
    }
    return null;
  }

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
  return null;
}

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

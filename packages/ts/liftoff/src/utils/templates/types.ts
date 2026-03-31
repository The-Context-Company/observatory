import type { WizardContext } from "../../types.js";

/** A single file operation to create or modify during instrumentation */
export interface FileOperation {
  /** Relative path from installDir */
  filePath: string;
  /** Whether to create a new file or modify an existing one */
  action: "create" | "modify";
  /** Full file content for "create" actions */
  content: string;
  /** Human-readable description of what this file does */
  description: string;
}

/** Result of a template generation */
export interface TemplateResult {
  /** Primary instrumentation files to create */
  files: FileOperation[];
  /** Additional gotcha-fix files (e.g., experimental_telemetry patches) */
  gotchaFixes: FileOperation[];
}

/** Function signature for all framework template modules */
export type GetTemplateFn = (ctx: WizardContext) => TemplateResult;

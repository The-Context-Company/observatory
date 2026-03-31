import { createTwoFilesPatch } from "diff";
import pc from "picocolors";
import * as p from "@clack/prompts";

/**
 * A file change to review and optionally apply.
 */
export interface FileChange {
  /** Relative path to the file */
  filePath: string;
  /** Current file content (empty string for new files) */
  oldContent: string;
  /** Proposed new file content */
  newContent: string;
  /** Human-readable description of the change */
  description: string;
}

/**
 * Colorize a unified diff patch string for terminal display.
 *
 * - Green for added lines (`+`)
 * - Red for removed lines (`-`)
 * - Cyan for hunk headers (`@@`)
 * - Bold for file headers (`+++`/`---`)
 * - Dim for context lines
 */
export function formatColoredDiff(patch: string): string {
  return patch
    .split("\n")
    .map((line) => {
      if (line.startsWith("+++") || line.startsWith("---")) {
        return pc.bold(line);
      }
      if (line.startsWith("+")) return pc.green(line);
      if (line.startsWith("-")) return pc.red(line);
      if (line.startsWith("@@")) return pc.cyan(line);
      return pc.dim(line);
    })
    .join("\n");
}

/**
 * Show colored diffs for each file change and prompt the user
 * to accept or reject each one individually.
 *
 * @returns Lists of applied and skipped file paths.
 */
export async function reviewAndApplyChanges(
  changes: FileChange[],
): Promise<{ applied: string[]; skipped: string[] }> {
  const applied: string[] = [];
  const skipped: string[] = [];

  for (const change of changes) {
    const isNew = change.oldContent === "";

    const patch = createTwoFilesPatch(
      change.filePath,
      change.filePath,
      change.oldContent,
      change.newContent,
    );

    const label = isNew
      ? `${pc.green("CREATE")} ${change.filePath}`
      : `${pc.yellow("MODIFY")} ${change.filePath}`;

    p.note(
      formatColoredDiff(patch),
      `${label} -- ${change.description}`,
    );

    const shouldApply = await p.confirm({
      message: `Apply ${isNew ? "new file" : "changes to"} ${change.filePath}?`,
      initialValue: true,
    });

    if (p.isCancel(shouldApply) || !shouldApply) {
      skipped.push(change.filePath);
    } else {
      applied.push(change.filePath);
    }
  }

  return { applied, skipped };
}

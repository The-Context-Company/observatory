import { structuredPatch } from "diff";
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
 * Render a unified diff as Claude-Code-style line-numbered output:
 *
 *   12 │   const x = 1;
 *   13 │ - const y = 2;
 *   13 │ + const y = 3;
 *   14 │   const z = 4;
 *
 * Skips the unified-diff file headers and `@@` hunk markers — those
 * are noise when the filename is already in the box title.
 *
 * For brand-new files (oldContent === ""), shows just the new content
 * with "+" prefixes and line numbers starting at 1.
 */
export function formatColoredDiff(
  oldContent: string,
  newContent: string,
  filePath: string,
): string {
  // New-file case: show the whole new content with + prefix + line nums.
  if (oldContent === "") {
    const lines = newContent.split("\n");
    // Drop the trailing empty line that `split` produces on a final newline.
    if (lines[lines.length - 1] === "") lines.pop();
    const width = String(lines.length).length;
    return lines
      .map((line, i) => {
        const ln = String(i + 1).padStart(width, " ");
        return pc.dim(ln) + pc.dim(" │ ") + pc.green("+ " + line);
      })
      .join("\n");
  }

  const patch = structuredPatch(
    filePath,
    filePath,
    oldContent,
    newContent,
    "",
    "",
    { context: 3 },
  );

  const out: string[] = [];
  const numWidth = Math.max(
    3,
    String(
      patch.hunks.reduce(
        (m, h) =>
          Math.max(m, h.oldStart + h.oldLines, h.newStart + h.newLines),
        0,
      ),
    ).length,
  );

  for (let h = 0; h < patch.hunks.length; h++) {
    const hunk = patch.hunks[h];
    if (h > 0) out.push(pc.dim("  " + "…".padStart(numWidth)) + pc.dim(" │"));

    let oldLn = hunk.oldStart;
    let newLn = hunk.newStart;
    for (const raw of hunk.lines) {
      const marker = raw[0];
      const content = raw.slice(1);
      if (marker === "-") {
        const ln = String(oldLn).padStart(numWidth, " ");
        out.push(pc.dim(ln) + pc.dim(" │ ") + pc.red("- " + content));
        oldLn++;
      } else if (marker === "+") {
        const ln = String(newLn).padStart(numWidth, " ");
        out.push(pc.dim(ln) + pc.dim(" │ ") + pc.green("+ " + content));
        newLn++;
      } else {
        const ln = String(newLn).padStart(numWidth, " ");
        out.push(pc.dim(ln) + pc.dim(" │   ") + pc.dim(content));
        oldLn++;
        newLn++;
      }
    }
  }

  return out.join("\n");
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

    const label = isNew
      ? `${pc.green("NEW")}  ${pc.bold(change.filePath)}`
      : `${pc.yellow("EDIT")} ${pc.bold(change.filePath)}`;

    p.note(
      formatColoredDiff(
        change.oldContent,
        change.newContent,
        change.filePath,
      ),
      `${label}  ${pc.dim("— " + change.description)}`,
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

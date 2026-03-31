---
phase: 04-instrumentation-gotcha-fixes
plan: 03
subsystem: liftoff-utils
tags: [diff-display, codebase-context, ai-instrumentation, cli]
dependency_graph:
  requires: []
  provides: [diff-display-utility, codebase-context-extraction]
  affects: [instrument-step, ai-endpoint-integration]
tech_stack:
  added: [diff@8.0.4]
  patterns: [colored-unified-diff, budget-constrained-file-collection, shallow-recursive-scan]
key_files:
  created:
    - packages/ts/liftoff/src/utils/diff-display.ts
    - packages/ts/liftoff/src/utils/codebase-context.ts
  modified:
    - packages/ts/liftoff/package.json
    - pnpm-lock.yaml
decisions:
  - Used picocolors for diff coloring (already in deps, lighter than chalk)
  - 8KB budget with 100-line file truncation for context extraction
  - Shallow scan (3 levels) of common dirs to avoid slow filesystem traversal
  - Slimmed package.json (deps only) to save context budget
metrics:
  duration: 106s
  completed: 2026-03-30
  tasks: 2
  files: 4
---

# Phase 04 Plan 03: Diff Display + Codebase Context Utilities Summary

Colored diff display with per-file accept/reject via @clack/prompts, plus budget-constrained codebase context extraction covering all 12 frameworks for AI instrumentation endpoint.

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Install diff package and create diff display utility | 983bdb4 | diff-display.ts, package.json |
| 2 | Create codebase context extraction utility | 323c59b | codebase-context.ts |

## What Was Built

### diff-display.ts
- `FileChange` interface for describing file modifications
- `formatColoredDiff(patch)` -- colorizes unified diff output (green additions, red removals, cyan hunks, bold headers, dim context)
- `reviewAndApplyChanges(changes)` -- shows each change as a colored diff note, prompts per-file accept/reject via `p.confirm()`, returns `{ applied, skipped }` path lists
- CREATE label (green) for new files, MODIFY label (yellow) for existing files
- Cancel-safe: `p.isCancel()` treated as skip

### codebase-context.ts
- `CodebaseContext` and `ContextFile` interfaces matching the AI endpoint request contract
- `collectCodebaseContext(ctx)` -- main function that extracts framework-specific files within 8KB budget
- Framework-specific collection for all 12 frameworks:
  - nextjs-aisdk: next.config variants, instrumentation.ts, AI SDK call sites
  - claude-agent-sdk, langchain-ts, pi-mono, openclaw: import-based file detection
  - mastra: `new Mastra(` pattern detection
  - custom-ts: main entry from package.json
  - Python frameworks: main.py, app.py, pyproject.toml
- Auth/session metadata pattern detection (up to 2 files with session/userId/auth patterns)
- Existing instrumentation detection (tcc-instrumentation/tcc_instrumentation files)
- Shallow recursive scan (max 3 levels) skipping node_modules, .next, __pycache__, .git, dist, .venv

## Deviations from Plan

None -- plan executed exactly as written.

## Known Stubs

None -- both utilities are fully implemented and ready for integration with the instrument pipeline step.

## Self-Check: PASSED

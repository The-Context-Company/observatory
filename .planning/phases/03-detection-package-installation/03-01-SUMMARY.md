---
phase: 03-detection-package-installation
plan: 01
subsystem: detection
tags: [types, framework-detection, package-manager, python-detection]
dependency_graph:
  requires: []
  provides: [Framework, PackageManager, ProjectLanguage, FRAMEWORKS, FRAMEWORK_PACKAGES, detectFramework, detectLanguage, detectPackageManager, getInstallCommand, isPackageInstalled, parsePyprojectDeps, parseRequirementsTxt]
  affects: [packages/ts/liftoff/src/types.ts, packages/ts/liftoff/src/utils/framework-detection.ts, packages/ts/liftoff/src/utils/package-manager.ts]
tech_stack:
  added: []
  patterns: [python-dep-parsing-via-regex, language-aware-pm-detection]
key_files:
  created:
    - packages/ts/liftoff/src/utils/python-detection.ts
  modified:
    - packages/ts/liftoff/src/types.ts
    - packages/ts/liftoff/src/utils/framework-detection.ts
    - packages/ts/liftoff/src/utils/package-manager.ts
decisions:
  - "Used regex for pyproject.toml parsing instead of TOML library (per plan, keeps deps minimal)"
  - "detectPackageManager now requires language parameter for correct TS vs Python lockfile routing"
  - "isPackageInstalled uses pip show for all Python PMs (checks same site-packages)"
metrics:
  duration: 168s
  completed: "2026-03-31T06:53:11Z"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 4
---

# Phase 03 Plan 01: Detection Utilities Summary

Extended liftoff type system to 12 frameworks and 7 package managers, ported and expanded detection utilities from @contextcompany/init to handle both TypeScript and Python project detection with pyproject.toml and requirements.txt parsing.

## What Was Done

### Task 1: Expand types and FRAMEWORKS metadata (8f0e94b)

Updated `packages/ts/liftoff/src/types.ts`:

- Expanded `Framework` union from 5 to 12 variants (added pi-mono, openclaw, langchain-python, crewai, agno, litellm, custom-python)
- Expanded `PackageManager` union from 4 to 7 variants (added pip, poetry, uv)
- Added `ProjectLanguage` type ("typescript" | "python" | "unknown")
- Added `language?: ProjectLanguage` field to `WizardContext`
- Expanded `FRAMEWORKS` array from 5 to 12 entries with metadata
- Added `FRAMEWORK_PACKAGES` constant mapping all 12 frameworks to their install packages

### Task 2: Create detection and package-manager utilities (9f08baa)

Created `packages/ts/liftoff/src/utils/python-detection.ts`:
- `parsePyprojectDeps` -- parses `[project]` dependencies and optional-dependencies from pyproject.toml via regex
- `parseRequirementsTxt` -- parses requirements.txt with comment/flag filtering and name normalization

Updated `packages/ts/liftoff/src/utils/framework-detection.ts`:
- Added `hasPythonDep` helper for normalized Python dep matching
- Added `detectLanguage` function (package.json -> TS, pyproject.toml/requirements.txt -> Python, else unknown)
- Extended `detectFramework` to handle all 12 frameworks: 7 TS (via package.json) + 5 Python (via pyproject.toml/requirements.txt)
- Added Pi-Mono detection (`@mariozechner/pi-coding-agent`), OpenClaw detection (openclaw.json or dep)

Updated `packages/ts/liftoff/src/utils/package-manager.ts`:
- Split lockfiles into TS_LOCKFILES and PYTHON_LOCKFILES arrays
- `detectPackageManager` now takes `language` parameter for correct routing (TS lockfiles vs Python lockfiles)
- Extended `getInstallCommand` with pip/poetry/uv support (quoted package names for bracket extras)
- Added `isPackageInstalled` -- checks node_modules for TS, `pip show` for Python
- Extended `getRunDevCommand` with Python PM fallback

## Decisions Made

1. **Regex for pyproject.toml** -- Used regex parsing instead of a TOML library to keep dependencies minimal. Handles `[project]` dependencies and `[project.optional-dependencies]` sections.
2. **Language-aware PM detection** -- `detectPackageManager` now requires a `language` parameter to route correctly between TS and Python lockfile checks. This is a breaking change from the init version but the correct approach for multi-language support.
3. **pip show for all Python PMs** -- `isPackageInstalled` uses `pip show` regardless of Python PM (pip/poetry/uv) since they all install to the same site-packages.

## Deviations from Plan

None -- plan executed exactly as written.

## Known Stubs

None -- all functions are fully implemented with real detection logic.

## Verification

- TypeScript compiles without new errors (pre-existing errors in frameworks/ directory are unrelated)
- All 12 frameworks present in type union and FRAMEWORKS array
- All 7 package managers present in PackageManager type
- framework-detection.ts imports from python-detection.ts (key link verified)
- Detection covers all specified framework indicators (DET-01 through DET-12)

## Self-Check: PASSED

All 4 files verified present. Both commit hashes (8f0e94b, 9f08baa) verified in git log.

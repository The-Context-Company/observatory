---
phase: 03-detection-package-installation
plan: 02
subsystem: cli
tags: [clack, prompts, framework-detection, package-install, spinner, pipeline]

requires:
  - phase: 03-detection-package-installation/01
    provides: Framework types, FRAMEWORKS array, detectFramework, detectPackageManager utilities
provides:
  - detectFrameworkStep pipeline step with interactive framework selection
  - installPackagesStep pipeline step with spinner and skip-installed logic
  - FRAMEWORK_PACKAGES mapping (framework -> SDK packages)
  - isPackageInstalled utility function
  - Updated pipeline order in index.ts
affects: [04-instrumentation, 07-success-summary]

tech-stack:
  added: []
  patterns: [pipeline step with p.select for user confirmation, spinner-wrapped execSync for package install]

key-files:
  created:
    - packages/ts/liftoff/src/steps/detect-framework.ts
    - packages/ts/liftoff/src/steps/install-packages.ts
  modified:
    - packages/ts/liftoff/src/types.ts
    - packages/ts/liftoff/src/utils/package-manager.ts
    - packages/ts/liftoff/src/steps/placeholder.ts
    - packages/ts/liftoff/src/index.ts

key-decisions:
  - "Added FRAMEWORK_PACKAGES mapping to types.ts since 03-01 did not create it"
  - "Added isPackageInstalled to package-manager.ts checking package.json deps"
  - "All frameworks are TS-only (no Python frameworks in current types) so no language filtering needed"

patterns-established:
  - "Interactive step pattern: auto-detect then p.select() for user confirmation with (detected) hint"
  - "Install step pattern: filter already-installed, spinner-wrapped execSync, manual fallback on failure"

requirements-completed: [CLI-02, CLI-03, DET-11, PKG-01, PKG-02, PKG-03, PKG-04, PKG-05]

duration: 2min
completed: 2026-03-31
---

# Phase 3 Plan 2: Detection and Install Pipeline Steps Summary

**Interactive framework detection with p.select() confirmation and spinner-wrapped package installation with skip-installed logic**

## Performance

- **Duration:** 2 min 15 sec
- **Started:** 2026-03-31T06:55:09Z
- **Completed:** 2026-03-31T06:57:24Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Created detectFrameworkStep: auto-detects framework from project files, presents interactive p.select() for user confirmation with "(detected)" hint on auto-detected option
- Created installPackagesStep: looks up FRAMEWORK_PACKAGES, filters out already-installed packages, runs install with spinner, provides manual fallback command on failure
- Wired both real steps into pipeline replacing placeholders, maintaining correct order: git-check -> auth -> keys -> detect -> install -> instrument -> mcp -> slack -> summary

## Task Commits

Each task was committed atomically:

1. **Task 1: Create detect-framework and install-packages steps** - `c3fb2b3` (feat)
2. **Task 2: Wire steps into pipeline and remove placeholders** - `f6c1f2b` (feat)

## Files Created/Modified
- `packages/ts/liftoff/src/steps/detect-framework.ts` - Pipeline step: auto-detect framework, present p.select, set ctx.framework and ctx.packageManager
- `packages/ts/liftoff/src/steps/install-packages.ts` - Pipeline step: install SDK packages with spinner, skip already-installed
- `packages/ts/liftoff/src/types.ts` - Added FRAMEWORK_PACKAGES record mapping framework to SDK package names
- `packages/ts/liftoff/src/utils/package-manager.ts` - Added isPackageInstalled utility checking package.json deps
- `packages/ts/liftoff/src/steps/placeholder.ts` - Removed detect-framework and install-packages entries (8 -> 6 placeholders)
- `packages/ts/liftoff/src/index.ts` - Imported real steps, updated getSteps() with correct pipeline ordering

## Decisions Made
- Added FRAMEWORK_PACKAGES mapping to types.ts -- 03-01 created Framework type and FRAMEWORKS array but not the package mapping. Required for install step to know which packages to install per framework.
- Added isPackageInstalled to package-manager.ts -- checks package.json dependencies/devDependencies rather than probing node_modules, which is simpler and more reliable.
- No language filtering on framework options -- current types.ts only has TypeScript frameworks (no Python frameworks were added in 03-01), so all frameworks are shown. Python framework support can be added when types are expanded.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added FRAMEWORK_PACKAGES mapping**
- **Found during:** Task 1 (detect-framework step creation)
- **Issue:** Plan references FRAMEWORK_PACKAGES from types.ts but 03-01 did not create it
- **Fix:** Added FRAMEWORK_PACKAGES record to types.ts mapping each Framework to its SDK packages
- **Files modified:** packages/ts/liftoff/src/types.ts
- **Verification:** TypeScript compiles, install step imports and uses it successfully
- **Committed in:** c3fb2b3 (Task 1 commit)

**2. [Rule 2 - Missing Critical] Added isPackageInstalled utility**
- **Found during:** Task 1 (install-packages step creation)
- **Issue:** Plan references isPackageInstalled from package-manager.ts but 03-01 did not create it
- **Fix:** Added isPackageInstalled function checking package.json dependencies
- **Files modified:** packages/ts/liftoff/src/utils/package-manager.ts
- **Verification:** TypeScript compiles, install step uses it for skip-installed logic
- **Committed in:** c3fb2b3 (Task 1 commit)

**3. [Rule 3 - Blocking] Adapted to actual codebase interfaces**
- **Found during:** Task 1
- **Issue:** Plan interfaces (ProjectLanguage, detectLanguage, Python frameworks) don't exist in actual codebase. 03-01 only created TS frameworks.
- **Fix:** Implemented steps using actual available interfaces. No language filtering since all frameworks are TS. detectPackageManager called without language param (matches actual signature).
- **Files modified:** detect-framework.ts, install-packages.ts
- **Verification:** TypeScript compiles, build succeeds
- **Committed in:** c3fb2b3 (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (2 missing critical, 1 blocking)
**Impact on plan:** All auto-fixes necessary for correctness. No scope creep. Python framework support can be added when types.ts is expanded.

## Issues Encountered
- Pre-existing TypeScript errors in src/frameworks/ directory (unrelated to this plan's changes) -- ignored as out of scope.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None -- all data sources are wired (FRAMEWORK_PACKAGES provides real package names, detectFramework provides real detection).

## Next Phase Readiness
- Detection and installation pipeline steps are complete and wired
- Phase 4 (instrumentation) can now access ctx.framework and ctx.packageManager set by these steps
- Pipeline ordering is correct for all remaining phases to slot in their steps

---
*Phase: 03-detection-package-installation*
*Completed: 2026-03-31*

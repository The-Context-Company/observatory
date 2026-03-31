---
phase: 04-instrumentation-gotcha-fixes
plan: 04
subsystem: cli
tags: [instrumentation, ai, templates, diff, gotcha-fixes, nextjs, vercel-ai-sdk]

requires:
  - phase: 04-instrumentation-gotcha-fixes/04-01
    provides: /api/cli/instrument endpoint for AI instrumentation
  - phase: 04-instrumentation-gotcha-fixes/04-02
    provides: 12 framework templates via getTemplate()
  - phase: 04-instrumentation-gotcha-fixes/04-03
    provides: diff-display.ts (reviewAndApplyChanges) and codebase-context.ts (collectCodebaseContext)
provides:
  - instrumentStep pipeline step with AI-first, template-fallback flow
  - detectGotchaFixes utility for framework-specific issue detection
  - Pipeline wiring replacing instrument placeholder
affects: [05-mcp-setup, 06-slack-setup, 07-success-summary]

tech-stack:
  added: []
  patterns: [ai-first-with-template-fallback, abort-controller-timeout, gotcha-detection]

key-files:
  created:
    - packages/ts/liftoff/src/steps/instrument.ts
    - packages/ts/liftoff/src/utils/gotcha-fixes.ts
  modified:
    - packages/ts/liftoff/src/steps/placeholder.ts
    - packages/ts/liftoff/src/index.ts

key-decisions:
  - "AbortController with 15s timeout for AI fetch (cleaner than Promise.race)"
  - "Gotcha fixes only for nextjs-aisdk framework (experimental_telemetry and instrumentationHook)"
  - "instrumentationHook fix skipped for Next.js 15+ (enabled by default)"

patterns-established:
  - "AI-first instrumentation: try AI endpoint, fall back to templates on failure/timeout/--key mode"
  - "Gotcha detection: scan project files for known issues, return FileChange arrays for diff review"

requirements-completed: [FIX-01, FIX-02, FIX-03, FIX-04]

duration: 2min
completed: 2026-03-31
---

# Phase 4 Plan 4: Instrument Pipeline Step Summary

**AI-first instrument step with 15s timeout, template fallback, gotcha detection for experimental_telemetry and instrumentationHook, and per-file diff review**

## Performance

- **Duration:** 2min 29s
- **Started:** 2026-03-31T07:30:50Z
- **Completed:** 2026-03-31T07:33:19Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created gotcha-fixes utility detecting experimental_telemetry and instrumentationHook issues for Next.js
- Built instrument pipeline step orchestrating AI-first instrumentation with template fallback
- Wired instrumentStep into the pipeline, replacing the instrument placeholder

## Task Commits

Each task was committed atomically:

1. **Task 1: Create gotcha-fixes utility** - `aee0bbc` (feat)
2. **Task 2: Create instrument pipeline step and wire into pipeline** - `888f2c7` (feat)

## Files Created/Modified
- `packages/ts/liftoff/src/utils/gotcha-fixes.ts` - Detects and generates fixes for experimental_telemetry (FIX-01) and instrumentationHook (FIX-02) with version-aware Next.js handling
- `packages/ts/liftoff/src/steps/instrument.ts` - Core instrument step: collects codebase context, tries AI endpoint, falls back to templates, appends gotcha fixes, shows colored diffs
- `packages/ts/liftoff/src/steps/placeholder.ts` - Removed instrument placeholder (3 remaining: setup-mcp, setup-slack, success-summary)
- `packages/ts/liftoff/src/index.ts` - Wired instrumentStep into pipeline between installPackages and postInstall steps

## Decisions Made
- Used AbortController with 15-second timeout for AI fetch (cleaner cleanup than Promise.race)
- Gotcha fixes only apply to nextjs-aisdk framework (only framework with known config gotchas)
- instrumentationHook fix version-gated: only for Next.js <15 since 15+ enables it by default

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - all functionality is fully wired. AI endpoint integration depends on the /api/cli/instrument endpoint built in plan 04-01 (in context repo).

## Next Phase Readiness
- Instrumentation pipeline is complete: detect -> install -> instrument flow works end-to-end
- Ready for Phase 5 (MCP setup) and Phase 6 (Slack setup) which are independent
- Three placeholder steps remain: setup-mcp, setup-slack, success-summary

---
*Phase: 04-instrumentation-gotcha-fixes*
*Completed: 2026-03-31*

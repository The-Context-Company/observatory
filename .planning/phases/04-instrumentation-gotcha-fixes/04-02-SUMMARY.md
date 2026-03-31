---
phase: 04-instrumentation-gotcha-fixes
plan: 02
subsystem: instrumentation
tags: [templates, frameworks, deterministic, fallback, typescript, python]

requires:
  - phase: 01-foundation
    provides: WizardContext type, Framework type, Step interface
provides:
  - 12 deterministic framework templates for instrumentation file generation
  - FileOperation/TemplateResult shared interfaces
  - getTemplate() async dispatcher with lazy loading for all 12 frameworks
affects: [04-instrumentation-gotcha-fixes, 07-first-win]

tech-stack:
  added: []
  patterns: [lazy-import-dispatcher, template-module-per-framework, exhaustive-switch]

key-files:
  created:
    - packages/ts/liftoff/src/utils/templates/types.ts
    - packages/ts/liftoff/src/utils/templates/index.ts
    - packages/ts/liftoff/src/utils/templates/nextjs-aisdk.ts
    - packages/ts/liftoff/src/utils/templates/claude-agent-sdk.ts
    - packages/ts/liftoff/src/utils/templates/langchain-ts.ts
    - packages/ts/liftoff/src/utils/templates/mastra.ts
    - packages/ts/liftoff/src/utils/templates/custom-ts.ts
    - packages/ts/liftoff/src/utils/templates/pi-mono.ts
    - packages/ts/liftoff/src/utils/templates/openclaw.ts
    - packages/ts/liftoff/src/utils/templates/langchain-python.ts
    - packages/ts/liftoff/src/utils/templates/crewai.ts
    - packages/ts/liftoff/src/utils/templates/agno.ts
    - packages/ts/liftoff/src/utils/templates/litellm.ts
    - packages/ts/liftoff/src/utils/templates/custom-python.ts
  modified: []

key-decisions:
  - "Used async getTemplate dispatcher with dynamic imports for lazy loading (no startup cost)"
  - "Exhaustive switch with never type ensures compile-time safety when new frameworks are added"
  - "Python templates always output .py files regardless of ctx.typescript setting"
  - "TS templates respect both ctx.typescript (TS vs JS content) and ctx.srcDir (src/ prefix)"

patterns-established:
  - "Template module pattern: each framework exports getTemplate(ctx) returning TemplateResult"
  - "All templates include tcc.conversational comment and sessionId TODO per D-06/D-07"
  - "Python templates use tcc_instrumentation.py naming (underscores), TS uses tcc-instrumentation (hyphens)"

requirements-completed: [INST-01, INST-02, INST-03, INST-04, INST-05, INST-06, INST-07, INST-08, INST-09, INST-10, INST-11, INST-12, INST-13, INST-17]

duration: 2min
completed: 2026-03-31
---

# Phase 04 Plan 02: Deterministic Framework Templates Summary

**12 framework-specific instrumentation templates with async lazy-loading dispatcher, covering Next.js/AI SDK, Claude Agent SDK, LangChain, Mastra, Custom TS, Pi-Mono, OpenClaw, and 5 Python frameworks**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-31T07:24:51Z
- **Completed:** 2026-03-31T07:27:05Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- Created shared FileOperation/TemplateResult interfaces for all template modules
- Built 7 TypeScript framework templates extracting content patterns from existing init/ modules
- Built 5 Python framework templates with correct contextcompany package imports
- Created async dispatcher that lazy-loads templates via dynamic import with exhaustive switch

## Task Commits

Each task was committed atomically:

1. **Task 1: Create template types and 7 TypeScript framework templates** - `1da01d3` (feat)
2. **Task 2: Create 5 Python framework templates and template dispatcher** - `093471d` (feat)

## Files Created/Modified
- `packages/ts/liftoff/src/utils/templates/types.ts` - FileOperation, TemplateResult, GetTemplateFn interfaces
- `packages/ts/liftoff/src/utils/templates/index.ts` - Async dispatcher with lazy imports for all 12 frameworks
- `packages/ts/liftoff/src/utils/templates/nextjs-aisdk.ts` - registerOTelTCC instrumentation.ts template
- `packages/ts/liftoff/src/utils/templates/claude-agent-sdk.ts` - instrumentClaudeAgent wrapper template
- `packages/ts/liftoff/src/utils/templates/langchain-ts.ts` - TCCCallbackHandler + setGlobalHandler template
- `packages/ts/liftoff/src/utils/templates/mastra.ts` - TCCMastraExporter helper template
- `packages/ts/liftoff/src/utils/templates/custom-ts.ts` - configure/run/sendRun with traceAgentCall example
- `packages/ts/liftoff/src/utils/templates/pi-mono.ts` - instrumentPiSession re-export template
- `packages/ts/liftoff/src/utils/templates/openclaw.ts` - tccPlugin re-export template
- `packages/ts/liftoff/src/utils/templates/langchain-python.ts` - instrument_langchain() auto-instrumentation
- `packages/ts/liftoff/src/utils/templates/crewai.ts` - instrument_crewai() auto-instrumentation
- `packages/ts/liftoff/src/utils/templates/agno.ts` - instrument_agno() auto-instrumentation
- `packages/ts/liftoff/src/utils/templates/litellm.ts` - TCCCallback registration template
- `packages/ts/liftoff/src/utils/templates/custom-python.ts` - run/step/tool_call/send_run builder pattern

## Decisions Made
- Used async getTemplate dispatcher with dynamic imports for lazy loading -- avoids loading all 12 template modules at startup
- Exhaustive switch with TypeScript never type ensures compile-time error when new frameworks are added to the Framework union type
- Python templates always output .py files regardless of ctx.typescript, matching Python ecosystem conventions
- Extracted content patterns directly from existing init/frameworks/ modules (nextjs-aisdk, claude-agent-sdk, langchain-ts, mastra, custom-ts) to maintain consistency

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all templates generate complete, functional instrumentation files with correct SDK package imports.

## Next Phase Readiness
- Templates are ready to be consumed by the instrumentation pipeline step
- Gotcha-fix templates (gotchaFixes arrays) are empty -- those will be populated by plan 04-03 or 04-04
- The dispatcher can be called as: `await getTemplate(ctx.framework, ctx)` from any pipeline step

## Self-Check: PASSED

All 14 created files verified on disk. Both task commits (1da01d3, 093471d) verified in git log.

---
*Phase: 04-instrumentation-gotcha-fixes*
*Completed: 2026-03-31*

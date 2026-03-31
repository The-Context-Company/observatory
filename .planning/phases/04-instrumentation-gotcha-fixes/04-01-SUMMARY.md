---
phase: 04-instrumentation-gotcha-fixes
plan: 01
subsystem: context-repo-api
tags: [ai-instrumentation, endpoint, anthropic, claude]
dependency_graph:
  requires: []
  provides: ["/api/cli/instrument endpoint"]
  affects: ["CLI instrument step (04-02+)"]
tech_stack:
  added: ["@anthropic-ai/sdk"]
  patterns: ["Bearer token auth + decodeJwt", "Claude API proxy", "framework-specific prompt routing"]
key_files:
  created:
    - /Users/rohil/Documents/Programming/tcc/context/demo/src/app/api/cli/instrument/route.ts
  modified:
    - /Users/rohil/Documents/Programming/tcc/context/demo/package.json
    - /Users/rohil/Documents/Programming/tcc/context/pnpm-lock.yaml
decisions:
  - Used claude-sonnet-4-20250514 for speed and cost (~$0.01-0.03 per call)
  - 25-second timeout (not 15) to allow Claude adequate generation time while still responsive
  - Return empty patches array on failure (200 for no patches, 504 for timeout, 500 for errors) to enable CLI fallback
  - Framework-specific system prompts built inline via switch-case rather than external template files
metrics:
  duration: 163s
  completed: "2026-03-31T07:27:31Z"
---

# Phase 04 Plan 01: AI Instrumentation Endpoint Summary

POST /api/cli/instrument endpoint in context repo that proxies Claude for generating codebase-specific instrumentation patches across all 12 frameworks, with conservative metadata wiring and 25s timeout fallback.

## What Was Done

### Task 1: Create POST /api/cli/instrument endpoint

Created the AI instrumentation endpoint at `demo/src/app/api/cli/instrument/route.ts` in the context repo (branch: rohil/onboarding_goatness).

**Auth:** Bearer token verification using `decodeJwt` from jose -- identical pattern to `/api/cli/keys`.

**Framework prompts:** `buildSystemPrompt()` with `getFrameworkGuide()` switch covering all 12 frameworks:
- TypeScript: nextjs-aisdk, claude-agent-sdk, langchain-ts, mastra, custom-ts, pi-mono, openclaw
- Python: langchain-python, crewai, agno, litellm, custom-python
- Fallback for unknown frameworks

**Prompt constraints enforced:**
- D-05: Conservative metadata -- only wire obvious patterns, TODO for uncertain
- D-06: tcc.conversational: true as default with explanatory comment
- D-07: sessionId only wired if explicit pattern found, otherwise TODO
- D-16: No business logic modification

**Response parsing:** `parsePatches()` extracts JSON array from Claude response, validates each patch has filePath/action/content/description. `extractMetadata()` scans patch content for sessionId/userId/conversational wiring and TODO comments.

**Error handling:**
- 401 for missing/invalid auth token
- 400 for missing framework or invalid body
- 504 for 25-second timeout (CLI falls back to templates)
- 500 for other AI failures
- All error responses include `patches: []` so CLI can proceed with fallback

## Commits

| Task | Commit | Message | Repo |
|------|--------|---------|------|
| 1 | 04053b6e | feat(04-01): create POST /api/cli/instrument AI instrumentation endpoint | context |

## Deviations from Plan

None -- plan executed exactly as written.

## Decisions Made

1. **claude-sonnet-4-20250514 model:** Per research recommendation. Fast, cheap, good at code generation.
2. **25-second timeout:** Plan specified 25s. Research suggested 15s but plan takes precedence.
3. **Inline framework guides:** Built as a switch-case in the same file rather than separate modules. Single-file endpoint is simpler and matches the existing /api/cli/auth and /api/cli/keys patterns.

## Known Stubs

None -- the endpoint is fully functional. It requires `ANTHROPIC_API_KEY` environment variable to be set on the server, which is a deployment concern, not a stub.

## Self-Check: PASSED

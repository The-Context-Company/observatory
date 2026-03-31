---
phase: 02-authentication-key-provisioning
plan: 03
subsystem: auth
tags: [oauth, workos, unkey, api-keys, env, clack, localhost-callback]

requires:
  - phase: 02-authentication-key-provisioning (plan 01)
    provides: Server relay endpoints (/api/cli/auth/start, /api/cli/auth/callback, /api/cli/auth, /api/cli/keys)
  - phase: 02-authentication-key-provisioning (plan 02)
    provides: localhost-server.ts, WizardContext with readonlyKey, open package
provides:
  - authStep: Browser OAuth login with localhost callback and timeout fallback
  - provisionKeysStep: API key provisioning with .env writing and idempotent skip
  - Pipeline wiring with real auth and key steps replacing placeholders
affects: [phase-04-instrumentation, phase-05-mcp-setup, phase-06-slack-setup, phase-07-success-summary]

tech-stack:
  added: []
  patterns: [step-shouldRun-idempotency, ctx-only-token-storage, env-write-with-skip]

key-files:
  created:
    - packages/ts/liftoff/src/steps/auth.ts
    - packages/ts/liftoff/src/steps/provision-keys.ts
  modified:
    - packages/ts/liftoff/src/index.ts
    - packages/ts/liftoff/src/steps/placeholder.ts

key-decisions:
  - "Tokens stored in WizardContext only, never persisted to disk (AUTH-05)"
  - "Manual key fallback sets keyProvided=true to skip MCP/Slack downstream"
  - "Lightweight Next.js detection via package.json for .env vs .env.local"

patterns-established:
  - "Step shouldRun guards: keyProvided and accessToken checks for auth-dependent steps"
  - "Env write with skip: always check hasEnvVariable before setEnvVariable (KEY-04)"
  - "Module-level activeServer for cleanup on Ctrl+C in long-running steps"

requirements-completed: [AUTH-01, AUTH-03, AUTH-04, AUTH-05, AUTH-06, KEY-01, KEY-02, KEY-03, KEY-04, KEY-05]

duration: 2min
completed: 2026-03-31
---

# Phase 2 Plan 3: Auth Step and Key Provisioning Summary

**Browser OAuth login with localhost callback, timeout fallback to manual key, and API key provisioning to .env with idempotent skip**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-31T06:32:34Z
- **Completed:** 2026-03-31T06:35:17Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Auth step opens browser to WorkOS login, receives callback on localhost, exchanges code for tokens, stores in context only
- 30s timeout with manual key fallback via clack prompt (sets keyProvided=true to disable MCP/Slack)
- Key provisioning step calls POST /api/cli/keys, writes TCC_API_KEY and TCC_READONLY_KEY to .env (or .env.local for Next.js)
- Never overwrites existing env keys (warns and skips), always ensures .gitignore
- Pipeline wired: git-check -> auth -> provision-keys -> 6 remaining placeholders

## Task Commits

Each task was committed atomically:

1. **Task 1: Create auth step with browser OAuth and timeout fallback** - `79cb7f6` (feat)
2. **Task 2: Create key provisioning step and wire pipeline** - `7f5dc33` (feat)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified
- `packages/ts/liftoff/src/steps/auth.ts` - Browser OAuth step with localhost callback, timeout fallback, cleanup
- `packages/ts/liftoff/src/steps/provision-keys.ts` - Key provisioning step with .env writing, idempotent skip, .gitignore
- `packages/ts/liftoff/src/index.ts` - Pipeline wiring with authStep and provisionKeysStep
- `packages/ts/liftoff/src/steps/placeholder.ts` - Removed authenticate and provision-keys placeholders (6 remain)

## Decisions Made
- Tokens stored in WizardContext only, never persisted to disk (AUTH-05)
- Manual key fallback sets keyProvided=true to skip MCP/Slack downstream
- Lightweight Next.js detection via package.json for .env vs .env.local decision

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed open package dependency**
- **Found during:** Task 1 (auth step creation)
- **Issue:** open@^10.2.0 was listed in package.json but not installed in node_modules
- **Fix:** Ran `pnpm install --filter @contextcompany/liftoff` to resolve
- **Files modified:** pnpm-lock.yaml
- **Verification:** TypeScript compilation passes with no errors in auth.ts
- **Committed in:** 79cb7f6 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential for open package import. No scope creep.

## Issues Encountered
None beyond the dependency installation noted above.

## Known Stubs
None - all data flows are wired to real API endpoints.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Auth and key provisioning steps are complete and wired into the pipeline
- Remaining 6 placeholder steps ready for replacement in subsequent phases
- ctx.accessToken and ctx.readonlyKey available for MCP setup (Phase 5) and Slack setup (Phase 6)

---
*Phase: 02-authentication-key-provisioning*
*Completed: 2026-03-31*

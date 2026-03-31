---
phase: 06-slack-integration
plan: 01
subsystem: integrations
tags: [slack, oauth, cli, localhost-server, callback]

# Dependency graph
requires:
  - phase: 01-server-endpoints
    provides: CLI auth pattern (Bearer token, decodeJwt), encryptToken, postgresDb
  - phase: 02-auth-flow
    provides: localhost callback server, open package, WizardContext.accessToken
  - phase: 05-mcp-editor-integration
    provides: setupMcpStep pipeline position (slack goes after MCP)
provides:
  - setupSlackStep pipeline step for Slack workspace connection
  - GET /api/cli/slack-client-id server endpoint
  - POST /api/cli/slack-callback server endpoint for token exchange
  - WizardContext.slackConnected field for success summary
affects: [07-success-summary]

# Tech tracking
tech-stack:
  added: []
  patterns: [server-side OAuth code exchange via CLI relay, module-level cleanup function]

key-files:
  created:
    - packages/ts/liftoff/src/steps/setup-slack.ts
    - context/demo/src/app/api/cli/slack-client-id/route.ts
    - context/demo/src/app/api/cli/slack-callback/route.ts
  modified:
    - packages/ts/liftoff/src/types.ts
    - packages/ts/liftoff/src/index.ts
    - packages/ts/liftoff/src/steps/placeholder.ts

key-decisions:
  - "CLI opens browser directly to Slack OAuth URL (not through context repo redirect)"
  - "Server-side code exchange via /api/cli/slack-callback keeps client_secret off CLI"
  - "Slack client ID fetched from server at runtime (not hardcoded in CLI)"
  - "60s timeout for Slack OAuth (longer than 30s default for auth)"

patterns-established:
  - "CLI-to-server OAuth relay: CLI handles browser+callback, server handles secret exchange"
  - "Module-level closeServer variable for cleanup access across step lifecycle"

requirements-completed: [SLK-01, SLK-02, SLK-03, SLK-04, SLK-05]

# Metrics
duration: 3min
completed: 2026-03-31
---

# Phase 6 Plan 1: Slack Integration Summary

**Slack workspace connection via CLI OAuth relay with server-side token exchange and /subscribe guidance**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-31T07:45:56Z
- **Completed:** 2026-03-31T07:48:54Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Created setupSlackStep with full OAuth flow: prompt, browser open, localhost callback, server-side exchange
- Added two server endpoints in context repo for Slack client ID retrieval and OAuth code exchange
- Wired real step into pipeline replacing placeholder, pipeline order now complete through Phase 6

## Task Commits

Each task was committed atomically:

1. **Task 1: Create setup-slack pipeline step** - `b5e3c2c` (feat) + context repo `11861c94` (feat)
2. **Task 2: Wire setup-slack into pipeline and remove placeholder** - `bb15f91` (feat)

## Files Created/Modified
- `packages/ts/liftoff/src/steps/setup-slack.ts` - Slack setup pipeline step with OAuth flow
- `packages/ts/liftoff/src/types.ts` - Added slackConnected field to WizardContext
- `packages/ts/liftoff/src/index.ts` - Wired setupSlackStep into pipeline
- `packages/ts/liftoff/src/steps/placeholder.ts` - Removed setup-slack placeholder
- `context/demo/src/app/api/cli/slack-client-id/route.ts` - GET endpoint returning SLACK_CLIENT_ID
- `context/demo/src/app/api/cli/slack-callback/route.ts` - POST endpoint for OAuth code exchange and integration storage

## Decisions Made
- CLI opens browser directly to Slack OAuth URL rather than routing through context repo authorize endpoint -- simpler flow, fewer redirects
- Server-side code exchange via dedicated /api/cli/slack-callback keeps SLACK_CLIENT_SECRET off the CLI
- Slack client ID fetched from server at runtime via /api/cli/slack-client-id -- avoids hardcoding, allows rotation
- 60-second timeout for Slack OAuth callback (vs 30s default) since Slack workspace selection takes longer

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript errors in framework template files (PackageManager | undefined assignability) -- out of scope, not caused by this plan's changes
- Context repo files are in a separate git repository -- committed separately to each repo

## User Setup Required

None - no external service configuration required. SLACK_CLIENT_ID and SLACK_CLIENT_SECRET env vars already exist in context repo env validation.

## Next Phase Readiness
- Slack step complete, pipeline has all steps through Phase 6
- Ready for Phase 7 (success-summary) which will use ctx.slackConnected to show Slack status
- Only remaining placeholder steps: authenticate, provision-keys, success-summary

---
*Phase: 06-slack-integration*
*Completed: 2026-03-31*

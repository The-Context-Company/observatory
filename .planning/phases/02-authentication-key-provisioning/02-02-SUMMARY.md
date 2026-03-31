---
phase: 02-authentication-key-provisioning
plan: 02
subsystem: liftoff-auth-utilities
tags: [oauth, localhost-server, types, browser-launch]
dependency_graph:
  requires: [01-03]
  provides: [localhost-callback-server, wizard-context-readonly-key, open-package]
  affects: [02-03, 05-01]
tech_stack:
  added: [open@10.2.0]
  patterns: [localhost-callback-server, os-port-assignment, idempotent-cleanup]
key_files:
  created:
    - packages/ts/liftoff/src/utils/localhost-server.ts
  modified:
    - packages/ts/liftoff/src/types.ts
    - packages/ts/liftoff/package.json
decisions:
  - Used open@^10.2.0 (not v11) for Node 18 compatibility
  - Bound callback server to 127.0.0.1 only (not 0.0.0.0 or localhost string)
  - 30-second default timeout per AUTH-04 requirement
metrics:
  duration: 85s
  completed: 2026-03-31T06:30:10Z
  tasks_completed: 2
  tasks_total: 2
  files_changed: 4
---

# Phase 02 Plan 02: Auth Utilities and Type Updates Summary

Localhost callback server for OAuth flow, WizardContext readonlyKey field for MCP key storage, and open package for browser launching.

## What Was Done

### Task 1: Update WizardContext types and install open package
- Added `readonlyKey?: string` field to WizardContext interface with JSDoc comment
- Installed `open@^10.2.0` for cross-platform browser launching (v10, not v11, for Node 18 compat)
- Commit: `ce31f5c`

### Task 2: Create localhost callback server utility
- Created `packages/ts/liftoff/src/utils/localhost-server.ts`
- Exports `CallbackResult` interface and `startCallbackServer` function
- Server binds to `127.0.0.1` with OS-assigned port (port 0)
- Handles GET `/callback` with code and state parameter validation
- Serves HTML success page to browser on any callback hit
- 30-second default timeout, resolves `null` on timeout or state mismatch
- Idempotent `close()` with flag guard to prevent double-close
- Uses only `node:http` and `node:url` built-ins
- Commit: `9256299`

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

1. **open@^10.2.0 not v11**: v11 requires Node >= 20, project supports >= 18
2. **127.0.0.1 binding**: Prevents network exposure; localhost string could resolve to IPv6
3. **30s default timeout**: Matches AUTH-04 requirement for reasonable user wait time

## Known Stubs

None - all functionality is fully wired.

## Verification Results

- `readonlyKey` field present in WizardContext (types.ts line 90)
- `open` in package.json dependencies
- `localhost-server.ts` exports `startCallbackServer` and `CallbackResult`
- Server binds to `127.0.0.1` with port `0`
- Timeout defaults to `30_000`

## Self-Check: PASSED

All files exist, all commits verified.

---
phase: 02-authentication-key-provisioning
plan: 01
subsystem: server-auth-relay
tags: [workos, oauth, relay, next.js, api-routes]
dependency_graph:
  requires: []
  provides: [cli-auth-start-endpoint, cli-auth-callback-endpoint]
  affects: [cli-oauth-flow, browser-auth-redirect]
tech_stack:
  added: []
  patterns: [workos-authkit-oauth, base64url-state-encoding, localhost-relay]
key_files:
  created:
    - /Users/rohil/Documents/Programming/tcc/context/demo/src/app/api/cli/auth/start/route.ts
    - /Users/rohil/Documents/Programming/tcc/context/demo/src/app/api/cli/auth/callback/route.ts
  modified: []
decisions:
  - Used base64url encoding for state parameter to safely encode port and CLI state through OAuth redirect chain
  - HTML error pages (not JSON) for callback errors since user is in browser
  - 127.0.0.1 (not localhost) for CLI callback redirect per AUTH-02
metrics:
  duration: 1min
  completed: 2026-03-31
---

# Phase 02 Plan 01: Server-Side Auth Relay Endpoints Summary

Server-side OAuth relay endpoints in the context repo that bridge WorkOS callbacks to the CLI's localhost server, using base64url state encoding to carry the CLI port through the redirect chain.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Create GET /api/cli/auth/start | 071154af | demo/src/app/api/cli/auth/start/route.ts |
| 2 | Create GET /api/cli/auth/callback | 730a928c | demo/src/app/api/cli/auth/callback/route.ts |

## Implementation Details

### Task 1: GET /api/cli/auth/start

Created the entry point for CLI browser-based auth. Accepts `port` and `state` query parameters, validates them, encodes them as base64url JSON into the OAuth state parameter, and redirects the browser to WorkOS AuthKit login. The `redirect_uri` points to the server-side callback endpoint (not localhost) since WorkOS blocks localhost in production.

### Task 2: GET /api/cli/auth/callback

Created the relay endpoint that receives the WorkOS OAuth callback. Decodes the base64url state to extract the CLI's localhost port and original state, then redirects the browser to `http://127.0.0.1:{port}/callback` with the authorization code and state. The code is NOT exchanged here -- it is single-use and the CLI exchanges it via the existing POST /api/cli/auth endpoint. Error cases return user-friendly HTML pages since the user sees these in the browser.

## Relay Chain

```
CLI opens browser -> /api/cli/auth/start?port=X&state=Y
  -> WorkOS login page (redirect_uri = /api/cli/auth/callback)
  -> /api/cli/auth/callback?code=Z&state=encoded
  -> http://127.0.0.1:X/callback?code=Z&state=Y
  -> CLI exchanges code via POST /api/cli/auth
```

## Deviations from Plan

None -- plan executed exactly as written.

## Known Stubs

None -- both endpoints are fully implemented.

## Decisions Made

1. **base64url state encoding**: Used `Buffer.from(JSON.stringify({port, state})).toString("base64url")` to safely carry CLI port through the OAuth redirect chain without URL encoding issues.
2. **HTML error pages for callback**: Since the callback endpoint is hit in the browser (not by the CLI), validation errors return styled HTML pages with user-friendly messages telling the user to return to their terminal.
3. **127.0.0.1 over localhost**: Used the IP address `127.0.0.1` for the CLI callback redirect per the AUTH-02 requirement, avoiding DNS resolution issues with `localhost`.

## Notes

- Both files are in the **context repo** (`/Users/rohil/Documents/Programming/tcc/context`) on branch `rohil/onboarding_goatness`, not the observatory repo.
- The existing `POST /api/cli/auth` endpoint (which exchanges the code) was not modified.

## Self-Check: PASSED

- [x] start/route.ts exists
- [x] callback/route.ts exists
- [x] Commit 071154af found
- [x] Commit 730a928c found

---
phase: 05-mcp-editor-integration
plan: 01
subsystem: cli
tags: [mcp, cursor, claude-code, windsurf, vscode, opencode, editor-integration]

requires:
  - phase: 01-cli-foundation
    provides: "Step interface, WizardContext with readonlyKey/keyProvided, pipeline runner"
  - phase: 04-ai-instrumentation
    provides: "Pipeline wiring pattern, instrument step preceding MCP in order"
provides:
  - "MCP editor detection (5 editors: Cursor, Claude Code, Windsurf, VS Code, OpenCode)"
  - "MCP config file merge for file-based editors (preserves existing servers)"
  - "Claude Code CLI integration via `claude mcp add`"
  - "setup-mcp pipeline step wired between instrument and slack"
affects: [06-slack-integration, 07-success-summary]

tech-stack:
  added: []
  patterns: ["MCP config merge (read-modify-write JSON preserving mcpServers)", "CLI-based vs file-based editor config dispatch"]

key-files:
  created:
    - packages/ts/liftoff/src/utils/mcp-config.ts
    - packages/ts/liftoff/src/steps/setup-mcp.ts
  modified:
    - packages/ts/liftoff/src/index.ts
    - packages/ts/liftoff/src/steps/placeholder.ts
    - packages/ts/liftoff/src/types.ts

key-decisions:
  - "File-based editors use project-level config except Windsurf (global ~/.codeium/windsurf/mcp_config.json)"
  - "Claude Code uses CLI `claude mcp add` instead of file write"
  - "Readonly key (tcc_key_) used as Bearer token in all configs"

patterns-established:
  - "Editor config dispatch: configType 'file' vs 'cli' determines write strategy"
  - "JSON merge for MCP config: read existing, ensure mcpServers, set context-company entry, write back"

requirements-completed: [MCP-01, MCP-02, MCP-03, MCP-04, MCP-05, MCP-06, MCP-07]

duration: 2min
completed: 2026-03-31
---

# Phase 5 Plan 1: MCP Editor Integration Summary

**MCP setup step detecting 5 editors, merging JSON configs with readonly key, and CLI integration for Claude Code**

## Performance

- **Duration:** 2 min (113s)
- **Started:** 2026-03-31T07:38:51Z
- **Completed:** 2026-03-31T07:40:44Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Editor detection for Cursor, Claude Code, Windsurf, VS Code, and OpenCode via filesystem checks and CLI availability
- MCP config file writing with merge semantics that preserves existing servers (mcpServers key)
- Claude Code integration via `claude mcp add --transport http` CLI command
- Pipeline step with multiselect UI, detected editors pre-checked, benefits explanation, and graceful skip in --key mode

## Task Commits

Each task was committed atomically:

1. **Task 1: MCP config utilities** - `ab992b7` (feat)
2. **Task 2: MCP setup pipeline step + wire into CLI pipeline** - `9a05525` (feat)

## Files Created/Modified
- `packages/ts/liftoff/src/utils/mcp-config.ts` - Editor detection, config generation, merge logic, Claude Code CLI
- `packages/ts/liftoff/src/steps/setup-mcp.ts` - Pipeline step with multiselect, benefits display, config dispatch
- `packages/ts/liftoff/src/index.ts` - Wire setupMcpStep between instrument and slack placeholder
- `packages/ts/liftoff/src/steps/placeholder.ts` - Remove setup-mcp placeholder (4 entries remain)
- `packages/ts/liftoff/src/types.ts` - Fix pre-existing duplicate FRAMEWORK_PACKAGES

## Decisions Made
- File-based editors use project-level config except Windsurf which uses global config at `~/.codeium/windsurf/mcp_config.json`
- Claude Code detected by checking `which claude` binary on PATH
- Readonly key (tcc_key_) used as Bearer token in Authorization header for all MCP configs

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed duplicate FRAMEWORK_PACKAGES in types.ts**
- **Found during:** Task 1 (build verification)
- **Issue:** Pre-existing merge conflict left two `FRAMEWORK_PACKAGES` exports in types.ts, causing build failure
- **Fix:** Removed the first incomplete copy (lines 38-44), keeping the complete version (lines 138-155)
- **Files modified:** packages/ts/liftoff/src/types.ts
- **Verification:** Build passes with zero errors
- **Committed in:** ab992b7 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Fix was necessary to unblock build. Pre-existing issue, not caused by this plan.

## Issues Encountered
None beyond the pre-existing types.ts duplicate.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- MCP step is wired in pipeline order: instrument -> setup-mcp -> slack -> summary
- Slack placeholder ready for Phase 6 replacement
- Success summary placeholder ready for Phase 7

## Self-Check: PASSED

- All created files exist on disk
- All commit hashes found in git log
- Build passes with zero errors

---
*Phase: 05-mcp-editor-integration*
*Completed: 2026-03-31*

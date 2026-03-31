# Roadmap: @contextcompany/liftoff

## Overview

Liftoff takes developers from zero to full AI agent observability in under 2 minutes. The roadmap builds outward from server infrastructure and CLI skeleton, through auth and detection, to the core instrumentation value, then layers on integrations (MCP, Slack), and caps with the "first win" experience that makes users say "oh shit, this found something useful." Server-side work goes first because the CLI auth flow depends on endpoints in the context repo.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Server Endpoints + CLI Scaffold** - Build the server-side auth/key APIs and the CLI pipeline skeleton that everything plugs into
- [ ] **Phase 2: Authentication + Key Provisioning** - Browser OAuth login that provisions API keys without touching a dashboard
- [ ] **Phase 3: Detection + Package Installation** - Auto-detect framework, language, and package manager, then install the right SDK packages
- [ ] **Phase 4: Instrumentation + Gotcha Fixes** - AI-first instrumentation that generates project-specific patches, plus automatic framework config fixes
- [x] **Phase 5: MCP Editor Integration** - Connect AI coding tools to observability data via per-editor MCP configuration (completed 2026-03-31)
- [ ] **Phase 6: Slack Integration** - Walk users through Slack workspace connection with no Pro plan gate
- [x] **Phase 7: First Win + Success Summary** - Deep-link to dashboard and print a complete summary so users see value immediately (completed 2026-03-31)

## Phase Details

### Phase 1: Server Endpoints + CLI Scaffold
**Goal**: The CLI can be invoked, runs a step pipeline with shared context, and the server endpoints needed for auth and key provisioning exist and are deployed
**Depends on**: Nothing (first phase)
**Requirements**: CLI-01, CLI-04, CLI-05, CLI-06, CLI-07, SRV-01, SRV-02, SRV-03, SRV-04
**Success Criteria** (what must be TRUE):
  1. User can run `npx @contextcompany/liftoff` and see the wizard start with a spinner
  2. Ctrl+C at any point exits cleanly with no leftover temp files or zombie processes
  3. Running the wizard a second time detects previous setup and does not duplicate work
  4. POST /api/cli/auth and POST /api/cli/keys endpoints are deployed and return correct responses in the context repo
  5. Slack integration no longer requires a Pro plan in the context repo
**Plans:** 3 plans
Plans:
- [x] 01-01-PLAN.md -- Server endpoints (context repo): CLI auth + key provisioning API routes, Slack Pro gate removal
- [x] 01-02-PLAN.md -- CLI rename + pipeline scaffold: rename to @contextcompany/liftoff, Step interface, pipeline runner, entry point
- [ ] 01-03-PLAN.md -- CLI steps: git-check step, placeholder steps, end-to-end wiring

### Phase 2: Authentication + Key Provisioning
**Goal**: Users can authenticate via browser and get both API keys provisioned without ever visiting the dashboard
**Depends on**: Phase 1
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, KEY-01, KEY-02, KEY-03, KEY-04, KEY-05
**Success Criteria** (what must be TRUE):
  1. User's browser opens to WorkOS login and the CLI receives the auth callback automatically
  2. After login, a prod API key (tcc_prod_) and a readonly MCP key (tcc_key_) appear in the correct .env file
  3. Existing .env values are never overwritten -- wizard warns and skips if a key already exists
  4. Using --key flag skips auth entirely and warns that MCP and Slack setup will be unavailable
  5. If auth times out after 30 seconds, user sees a manual key fallback option
**Plans:** 1 plan
Plans:
- [x] 06-01-PLAN.md -- Slack OAuth step + server endpoints: setup-slack pipeline step with localhost callback, server-side token exchange, pipeline wiring

### Phase 3: Detection + Package Installation
**Goal**: The wizard correctly identifies any supported framework and installs the right SDK packages using the project's package manager
**Depends on**: Phase 1
**Requirements**: CLI-02, CLI-03, DET-01, DET-02, DET-03, DET-04, DET-05, DET-06, DET-07, DET-08, DET-09, DET-10, DET-11, DET-12, PKG-01, PKG-02, PKG-03, PKG-04, PKG-05
**Success Criteria** (what must be TRUE):
  1. Wizard correctly detects all supported TS frameworks (Next.js+AI SDK, Claude Agent SDK, LangChain TS, Mastra, Pi-Mono, OpenClaw, Custom TS) and Python frameworks (LangChain, CrewAI, Agno, LiteLLM, Custom Python)
  2. Wizard detects and uses the correct package manager (npm/yarn/pnpm/bun for TS, pip/poetry/uv for Python)
  3. In a monorepo, wizard does not false-positive on sub-dependencies and detects the primary framework
  4. Correct framework-specific packages are installed with a spinner, and already-installed packages are skipped
**Plans:** 2 plans
Plans:
- [ ] 03-01-PLAN.md -- Types expansion + detection utilities: extend Framework/PackageManager types, port detection from init, add Python parsing
- [x] 03-02-PLAN.md -- Pipeline steps + wiring: detect-framework and install-packages steps, replace placeholders, wire into pipeline

### Phase 4: Instrumentation + Gotcha Fixes
**Goal**: The user's codebase is instrumented with AI-generated, project-specific patches that wire up observability and metadata, and framework-specific gotchas are automatically fixed
**Depends on**: Phase 2, Phase 3
**Requirements**: INST-01, INST-02, INST-03, INST-04, INST-05, INST-06, INST-07, INST-08, INST-09, INST-10, INST-11, INST-12, INST-13, INST-14, INST-15, INST-16, INST-17, INST-18, FIX-01, FIX-02, FIX-03, FIX-04, FIX-05
**Success Criteria** (what must be TRUE):
  1. For each supported framework, the correct instrumentation file is created or the correct instrument call is injected
  2. AI generates project-specific patches that wire high-value metadata (userId, orgId, sessionId, conversation IDs) with TODOs for uncertain values
  3. User sees a summary/diff of AI-generated changes before they are applied (unless in auto-apply mode)
  4. Framework gotchas are automatically fixed (experimental_telemetry for AI SDK, instrumentationHook for Next.js, tcc.conversational and tcc.sessionId patterns)
  5. AI-generated changes do not modify business logic or control flow beyond instrumentation
**Plans:** 4 plans
Plans:
- [x] 04-01-PLAN.md -- AI instrumentation endpoint: POST /api/cli/instrument in context repo
- [x] 04-02-PLAN.md -- Framework templates: deterministic fallback templates for all 12 frameworks
- [x] 04-03-PLAN.md -- Utilities: colored diff display + codebase context extraction
- [x] 04-04-PLAN.md -- Instrument step + gotcha fixes: pipeline step with AI-first flow, template fallback, and gotcha detection
**UI hint**: yes

### Phase 5: MCP Editor Integration
**Goal**: The user's AI coding tools (Cursor, Claude Code, Windsurf, etc.) can query production runs, find failures, and search insights via MCP
**Depends on**: Phase 2
**Requirements**: MCP-01, MCP-02, MCP-03, MCP-04, MCP-05, MCP-06, MCP-07
**Success Criteria** (what must be TRUE):
  1. Wizard detects which MCP-capable editors are installed and shows them pre-checked
  2. MCP config is written for file-based editors (Cursor, Windsurf, VS Code) and `claude mcp add` is run for Claude Code
  3. Existing MCP configs are merged, not overwritten -- other servers remain intact
  4. The readonly key (tcc_key_) is used as Bearer token in all MCP configs
**Plans:** 1/1 plans complete
Plans:
- [x] 05-01-PLAN.md -- MCP config utilities + setup-mcp pipeline step: editor detection, config merging, Claude Code CLI, pipeline wiring

### Phase 6: Slack Integration
**Goal**: Users can connect Slack alerts during onboarding without needing a Pro plan
**Depends on**: Phase 2
**Requirements**: SLK-01, SLK-02, SLK-03, SLK-04, SLK-05
**Success Criteria** (what must be TRUE):
  1. After instrumentation, user is asked if they want Slack alerts and can decline gracefully
  2. Selecting yes opens browser to Slack OAuth and the CLI receives the callback
  3. User is guided to add the bot to a channel and run /subscribe
  4. Free-tier users can set up Slack (no Pro plan gate)
**Plans:** 1 plan
Plans:
- [ ] 06-01-PLAN.md -- Slack OAuth step + server endpoints: setup-slack pipeline step with localhost callback, server-side token exchange, pipeline wiring

### Phase 7: First Win + Success Summary
**Goal**: The user finishes the wizard knowing exactly what happened, what to do next, and sees their first traces appear in the dashboard
**Depends on**: Phase 4, Phase 5, Phase 6
**Requirements**: WIN-01, WIN-02, WIN-03, SUM-01, SUM-02, SUM-03, SUM-04, SUM-05, SUM-06
**Success Criteria** (what must be TRUE):
  1. User sees the exact command to run their app (e.g., "npm run dev" or "python main.py")
  2. Deep-link to dashboard runs page opens so user can watch traces appear in real-time
  3. Success summary prints: framework detected, all files created/modified, metadata hooks added, MCP editors configured, Slack status, and exact next step
**Plans:** 1/1 plans complete
Plans:
- [x] 07-01-PLAN.md -- Success summary step + context tracking: extend WizardContext with tracking fields, create success-summary step with receipt-style output, deep-link to dashboard

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7
(Phases 2 and 3 are independent of each other; Phases 5 and 6 are independent of each other)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Server Endpoints + CLI Scaffold | 0/3 | Planning complete | - |
| 2. Authentication + Key Provisioning | 0/? | Not started | - |
| 3. Detection + Package Installation | 0/2 | Planning complete | - |
| 4. Instrumentation + Gotcha Fixes | 0/4 | Planning complete | - |
| 5. MCP Editor Integration | 1/1 | Complete   | 2026-03-31 |
| 6. Slack Integration | 0/1 | Planning complete | - |
| 7. First Win + Success Summary | 1/1 | Complete   | 2026-03-31 |

### Phase 07.1: Move CLI routes from dashboard to public-api (INSERTED)

**Goal:** All 7 CLI API routes live in public-api at api.thecontext.company/cli/* instead of dashboard, and the liftoff CLI points at the new URLs
**Requirements**: D-01, D-02, D-03, D-04, D-05, D-06, D-07, D-08, D-09, D-10, D-11, D-12, D-13, D-14, D-15, D-16, D-17, D-18, D-19, D-20, D-21, D-22, D-23, D-24, D-25
**Depends on:** Phase 7
**Plans:** 3/3 plans complete

Plans:
- [x] 07.1-01-PLAN.md -- Create CLI routes in public-api: deps, env vars, encryption, postgres, 7 Hono routes, mount in index.ts
- [x] 07.1-02-PLAN.md -- Update liftoff CLI base URLs: DASHBOARD_BASE to API_BASE in all 4 step files
- [x] 07.1-03-PLAN.md -- Delete old dashboard CLI routes: rm -rf demo/src/app/api/cli/

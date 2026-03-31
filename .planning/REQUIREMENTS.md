# Requirements: @contextcompany/liftoff

**Defined:** 2026-03-30
**Core Value:** Get developers to their first "oh shit, this found something useful" moment as fast as possible.

## v1 Requirements

### CLI Foundation

- [x] **CLI-01**: User can run `npx @contextcompany/liftoff` to start the wizard
- [x] **CLI-02**: Wizard auto-detects framework from project files (package.json, pyproject.toml, requirements.txt) and confirms with user
- [x] **CLI-03**: Wizard detects package manager (npm/yarn/pnpm/bun for TS, pip/poetry/uv for Python)
- [x] **CLI-04**: Wizard checks git status and warns if working tree is dirty (but does not block)
- [x] **CLI-05**: Ctrl+C cleanly exits with no partial state left behind
- [x] **CLI-06**: Running wizard twice is idempotent — detects existing setup and skips/updates
- [x] **CLI-07**: Progress indicators (spinners) shown for each step

### Authentication

- [ ] **AUTH-01**: Wizard opens browser to WorkOS OAuth login via localhost callback server
- [x] **AUTH-02**: Localhost callback server listens on 127.0.0.1 (not localhost) before browser opens
- [ ] **AUTH-03**: User can skip auth only with explicit --key flag (existing TCC_API_KEY in .env does NOT skip auth — user may want to provision MCP/Slack which require identity)
- [ ] **AUTH-04**: Wizard handles auth timeout gracefully (30s default, shows manual key fallback)
- [x] **AUTH-05**: Auth tokens stored securely for session (not persisted to disk beyond .env keys)
- [ ] **AUTH-06**: When --key is used, wizard warns that MCP and Slack setup will be skipped (no user identity available)

### Key Provisioning

- [ ] **KEY-01**: After auth, wizard provisions org-level prod API key (tcc_prod_) via Unkey for TCC_API_KEY
- [ ] **KEY-02**: After auth, wizard provisions user-level readonly key (tcc_key_) via Unkey for MCP
- [ ] **KEY-03**: Keys are written to appropriate .env file (.env.local for Next.js, .env for others)
- [ ] **KEY-04**: Existing .env values are never overwritten — wizard warns and skips if key exists
- [ ] **KEY-05**: .env file is ensured in .gitignore

### Framework Detection

- [ ] **DET-01**: Detect Next.js + Vercel AI SDK (package.json: next + ai/@ai-sdk/*)
- [ ] **DET-02**: Detect Claude Agent SDK (package.json: @anthropic-ai/claude-agent-sdk)
- [ ] **DET-03**: Detect LangChain TS (package.json: @langchain/core or langchain)
- [ ] **DET-04**: Detect Mastra (package.json: @mastra/core)
- [ ] **DET-05**: Detect LangChain Python (pyproject.toml/requirements.txt: langchain)
- [ ] **DET-06**: Detect CrewAI (pyproject.toml/requirements.txt: crewai)
- [ ] **DET-07**: Detect Agno (pyproject.toml/requirements.txt: agno)
- [ ] **DET-08**: Detect Pi-Mono (package.json: @anthropic-ai/pi-mono or similar)
- [ ] **DET-09**: Detect OpenClaw (package.json: openclaw)
- [ ] **DET-10**: Detect LiteLLM Python (pyproject.toml/requirements.txt: litellm)
- [x] **DET-11**: Fall back to Custom TS or Custom Python — for users on unsupported frameworks, custom-built agent frameworks, or highly custom setups where library instrumentation would break. Custom gives most granularity over what is logged.
- [ ] **DET-12**: Handle monorepos — detect primary framework, don't false-positive on sub-dependencies

### Package Installation

- [x] **PKG-01**: Install correct framework-specific package (@contextcompany/otel for AI SDK, @contextcompany/claude for Claude, etc.)
- [x] **PKG-02**: Install using detected package manager with spinner
- [x] **PKG-03**: For Python, install contextcompany with correct extras (contextcompany[langchain], contextcompany[crewai], contextcompany[agno], contextcompany[litellm])
- [x] **PKG-04**: Install @contextcompany/pi for Pi-Mono, @contextcompany/openclaw for OpenClaw
- [x] **PKG-05**: Skip installation if packages already installed

### Instrumentation

- [ ] **INST-01**: Create instrumentation.ts for Next.js + Vercel AI SDK with registerOTelTCC()
- [ ] **INST-02**: Create tcc-instrumentation wrapper for Claude Agent SDK with instrumentClaudeAgent()
- [ ] **INST-03**: Create tcc-instrumentation for LangChain TS with TCCCallbackHandler
- [ ] **INST-04**: Inject TCCMastraExporter into existing Mastra config (or create fallback file)
- [ ] **INST-05**: Create tcc-instrumentation for Custom TS with configure()/run() helpers
- [ ] **INST-06**: Add instrument_langchain() call to Python LangChain entry point
- [ ] **INST-07**: Add instrument_crewai() call to Python CrewAI entry point
- [ ] **INST-08**: Add instrument_agno() call to Python Agno entry point
- [ ] **INST-09**: Create custom Python instrumentation with tcc.run()/step()/tool_call()
- [ ] **INST-10**: Instrument Pi-Mono with @contextcompany/pi
- [ ] **INST-11**: Instrument OpenClaw with @contextcompany/openclaw
- [ ] **INST-12**: Instrument LiteLLM Python with contextcompany[litellm]
- [ ] **INST-13**: Respect existing src/ directory structure and TypeScript/JavaScript preference
- [ ] **INST-14**: Wizard uses AI as the primary instrumentation path to generate minimal, project-specific patches for supported and custom codebases
- [ ] **INST-15**: AI infers and wires high-value existing metadata visible in the codebase (userId, orgId, sessionId, request IDs, route context, conversation/thread IDs, environment, etc.); sessionId is especially important — if the codebase has any chat/conversation concept with message memory, AI should wire that as tcc.sessionId to group runs into sessions; if uncertain about any value, adds TODOs instead of guessing
- [ ] **INST-16**: AI-generated changes must not modify business logic or control flow beyond what is required for instrumentation
- [ ] **INST-17**: For recognized frameworks, wizard may choose between AI-generated patches and deterministic templates, preferring whichever produces more complete instrumentation for that codebase
- [ ] **INST-18**: User is shown a summary or diff of AI-generated changes before apply, unless running in explicit auto-apply mode

### Gotcha Fixes

- [ ] **FIX-01**: For Vercel AI SDK: enable experimental_telemetry: { isEnabled: true } in AI calls
- [ ] **FIX-02**: For Next.js: ensure instrumentationHook is enabled in next.config
- [ ] **FIX-03**: Auto-add tcc.conversational: true to instrumentation metadata
- [ ] **FIX-04**: Auto-add tcc.sessionId and tcc.runId capture patterns appropriate to framework (not required, but heavily preferred — if the codebase has any concept of a chat/conversation with memory of previous messages, sessionId groups those into the same session for analysis)
- [ ] **FIX-05**: AI-inferred metadata (userId, orgId, etc.) handled via INST-15 — gotcha fixes focus on framework config, not metadata

### MCP Setup

- [ ] **MCP-01**: Detect editors with MCP config on disk (Cursor, Claude Code, Windsurf, OpenCode, VS Code)
- [ ] **MCP-02**: Show detected editors pre-checked, let user add others
- [ ] **MCP-03**: Write MCP config for file-based editors (Cursor: .cursor/mcp.json, Windsurf: ~/.codeium/windsurf/mcp_config.json)
- [ ] **MCP-04**: Run `claude mcp add` for Claude Code
- [ ] **MCP-05**: Merge with existing MCP config — never overwrite other servers
- [ ] **MCP-06**: Use the provisioned readonly key (tcc_key_) as Bearer token
- [ ] **MCP-07**: Show clear explanation of MCP benefits before setup ("Your AI coding tool can now query prod runs, find failures, and search insights")

### Slack Setup

- [ ] **SLK-01**: Ask user if they want Slack alerts after instrumentation completes
- [ ] **SLK-02**: Open browser to Slack OAuth for workspace connection (reuse localhost callback pattern)
- [ ] **SLK-03**: Guide user to add bot to channel and run /subscribe
- [ ] **SLK-04**: No Pro plan gate — free users get limited Slack reports
- [ ] **SLK-05**: Graceful skip if user declines or Slack auth fails

### First Win

- [ ] **WIN-01**: After all setup, tell user to run one real request with their app
- [ ] **WIN-02**: Deep-link to dashboard runs page (https://www.thecontext.company/prod/runs) so user sees traces appear
- [ ] **WIN-03**: Print exact next command to run ("npm run dev" / "python main.py" etc.)

### Success Summary

- [ ] **SUM-01**: Print framework detected and version
- [ ] **SUM-02**: Print all files created/modified with paths
- [ ] **SUM-03**: Print metadata hooks added (conversational, sessionId, userId)
- [ ] **SUM-04**: Print MCP editors configured
- [ ] **SUM-05**: Print Slack status (connected/skipped)
- [ ] **SUM-06**: Print exact next step to see first traces

### Server-Side (context repo)

- [x] **SRV-01**: New API endpoint for CLI OAuth token exchange (POST /api/cli/auth)
- [x] **SRV-02**: New API endpoint for CLI key provisioning (POST /api/cli/keys)
- [x] **SRV-03**: Remove Pro plan requirement for Slack integration
- [x] **SRV-04**: Endpoints authenticate via WorkOS session token from OAuth callback

## v2 Requirements

### Advanced CLI

- **ADV-01**: --dry-run flag that shows what WOULD change without changing anything
- **ADV-02**: --ci flag for non-interactive automated environments
- **ADV-03**: All options accepted as CLI flags (--framework, --key, --skip-slack, --skip-mcp)

### Polish

- **POL-01**: Animated intro banner
- **POL-02**: Time-to-complete metric shown at end
- **POL-03**: Device code flow fallback for SSH/container environments

## Out of Scope

| Feature | Reason |
|---------|--------|
| Modifying user business logic | AI instrumentation must not touch control flow or business logic beyond what instrumentation requires |
| Multi-project monorepo setup | Scope explosion — run liftoff in each service directory |
| Dashboard creation from CLI | Dashboard preferences are personal, let dashboard's own onboarding handle it |
| Automatic code refactoring | Too dangerous — only create new files and modify config, never touch business logic |
| Mobile SDK support | Web/server first |
| Self-hosted deployment | Cloud-first for now |
| Interactive tutorial in CLI | CLI is the wrong medium — deep-link to dashboard instead |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CLI-01 | Phase 1 | Complete |
| CLI-02 | Phase 3 | Complete |
| CLI-03 | Phase 3 | Complete |
| CLI-04 | Phase 1 | Complete |
| CLI-05 | Phase 1 | Complete |
| CLI-06 | Phase 1 | Complete |
| CLI-07 | Phase 1 | Complete |
| AUTH-01 | Phase 2 | Pending |
| AUTH-02 | Phase 2 | Complete |
| AUTH-03 | Phase 2 | Pending |
| AUTH-04 | Phase 2 | Pending |
| AUTH-05 | Phase 2 | Complete |
| AUTH-06 | Phase 2 | Pending |
| KEY-01 | Phase 2 | Pending |
| KEY-02 | Phase 2 | Pending |
| KEY-03 | Phase 2 | Pending |
| KEY-04 | Phase 2 | Pending |
| KEY-05 | Phase 2 | Pending |
| DET-01 | Phase 3 | Pending |
| DET-02 | Phase 3 | Pending |
| DET-03 | Phase 3 | Pending |
| DET-04 | Phase 3 | Pending |
| DET-05 | Phase 3 | Pending |
| DET-06 | Phase 3 | Pending |
| DET-07 | Phase 3 | Pending |
| DET-08 | Phase 3 | Pending |
| DET-09 | Phase 3 | Pending |
| DET-10 | Phase 3 | Pending |
| DET-11 | Phase 3 | Complete |
| DET-12 | Phase 3 | Pending |
| PKG-01 | Phase 3 | Complete |
| PKG-02 | Phase 3 | Complete |
| PKG-03 | Phase 3 | Complete |
| PKG-04 | Phase 3 | Complete |
| PKG-05 | Phase 3 | Complete |
| INST-01 | Phase 4 | Pending |
| INST-02 | Phase 4 | Pending |
| INST-03 | Phase 4 | Pending |
| INST-04 | Phase 4 | Pending |
| INST-05 | Phase 4 | Pending |
| INST-06 | Phase 4 | Pending |
| INST-07 | Phase 4 | Pending |
| INST-08 | Phase 4 | Pending |
| INST-09 | Phase 4 | Pending |
| INST-10 | Phase 4 | Pending |
| INST-11 | Phase 4 | Pending |
| INST-12 | Phase 4 | Pending |
| INST-13 | Phase 4 | Pending |
| INST-14 | Phase 4 | Pending |
| INST-15 | Phase 4 | Pending |
| INST-16 | Phase 4 | Pending |
| INST-17 | Phase 4 | Pending |
| INST-18 | Phase 4 | Pending |
| FIX-01 | Phase 4 | Pending |
| FIX-02 | Phase 4 | Pending |
| FIX-03 | Phase 4 | Pending |
| FIX-04 | Phase 4 | Pending |
| FIX-05 | Phase 4 | Pending |
| MCP-01 | Phase 5 | Pending |
| MCP-02 | Phase 5 | Pending |
| MCP-03 | Phase 5 | Pending |
| MCP-04 | Phase 5 | Pending |
| MCP-05 | Phase 5 | Pending |
| MCP-06 | Phase 5 | Pending |
| MCP-07 | Phase 5 | Pending |
| SLK-01 | Phase 6 | Pending |
| SLK-02 | Phase 6 | Pending |
| SLK-03 | Phase 6 | Pending |
| SLK-04 | Phase 6 | Pending |
| SLK-05 | Phase 6 | Pending |
| WIN-01 | Phase 7 | Pending |
| WIN-02 | Phase 7 | Pending |
| WIN-03 | Phase 7 | Pending |
| SUM-01 | Phase 7 | Pending |
| SUM-02 | Phase 7 | Pending |
| SUM-03 | Phase 7 | Pending |
| SUM-04 | Phase 7 | Pending |
| SUM-05 | Phase 7 | Pending |
| SUM-06 | Phase 7 | Pending |

**Coverage:**
- v1 requirements: 72 total
- Mapped to phases: 72
- Unmapped: 0

---
*Requirements defined: 2026-03-30*
*Last updated: 2026-03-30 after roadmap creation*

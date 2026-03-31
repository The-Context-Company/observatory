# @contextcompany/liftoff

## What This Is

A zero-friction CLI onboarding wizard (`npx @contextcompany/liftoff`) that takes developers from zero to full AI agent observability in under 2 minutes. It auto-detects the user's framework, authenticates via browser OAuth, provisions API keys, instruments their codebase, sets up MCP for their coding tools, connects Slack alerts, and deep-links them to their first insight — so they see value before they even read the docs.

## Core Value

Get developers to their first "oh shit, this found something useful" moment as fast as possible.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] CLI runs via `npx @contextcompany/liftoff` (rename from @contextcompany/init)
- [ ] Auto-detects framework from project files (package.json, pyproject.toml, requirements.txt)
- [ ] Supports TS frameworks: Next.js + Vercel AI SDK, Claude Agent SDK, LangChain TS, Mastra, Custom TS
- [ ] Supports Python frameworks: LangChain Python, CrewAI, Agno, Custom Python
- [ ] Browser-based OAuth via localhost callback (like `vercel login`) using WorkOS
- [ ] Provisions org-level prod API key (`tcc_prod_`) for TCC_API_KEY via Unkey
- [ ] Provisions user-level readonly key (`tcc_key_`) for MCP access via Unkey
- [ ] Graceful skip: respects existing TCC_API_KEY in .env or --key flag
- [ ] Installs correct framework-specific packages automatically
- [ ] Creates instrumentation files (e.g. instrumentation.ts for Next.js)
- [ ] Fixes framework gotchas automatically (e.g. experimental_telemetry for AI SDK)
- [ ] Auto-adds metadata hooks: tcc.conversational, tcc.sessionId, userId/orgId capture
- [ ] MCP setup: detects editors (Cursor, Claude Code, Windsurf, OpenCode), writes config with readonly key
- [ ] Slack setup: walks through workspace connection, channel, /subscribe — no Pro plan gate
- [ ] Seeds first win: deep-links to dashboard with built-in patterns (frustration, confusion, task failure) and insight search
- [ ] Prints success summary: framework detected, files changed, metadata added, exact next step
- [ ] Works for both new projects and existing codebases

### Out of Scope

- Mobile SDKs — web/server first
- Custom dashboard theming — not part of CLI
- CI/CD integration — separate concern, future phase
- Self-hosted deployment — cloud-first for now

## Context

**Ecosystem:** The Context Company is an AI agent observability platform. The observatory monorepo contains TypeScript SDK packages (@contextcompany/otel, @contextcompany/claude, @contextcompany/langchain, @contextcompany/mastra, @contextcompany/custom) and a Python package (contextcompany with extras like [langchain], [crewai], [agno]).

**Dashboard:** Next.js app at app.thecontext.company with WorkOS OAuth auth, Unkey API key management, Slack/Discord integrations (OAuth-based), and an MCP server at api.thecontext.company/mcp.

**Current state:** An init CLI exists at packages/ts/init/ with framework detection and instrumentation file creation. It lacks: OAuth, key provisioning, MCP setup, Slack setup, Python support, gotcha fixes, metadata hooks, and the "first win" deep-link experience. This project is a ground-up reimagining.

**Two repos in play:**
- `observatory` (this repo): The liftoff CLI package and SDK packages
- `context` (../context/): Dashboard, public-api, Slack bot — needs new CLI auth endpoint and Slack Pro plan gate removal

## Constraints

- **Auth provider**: WorkOS AuthKit — must use their OAuth flow
- **API key provider**: Unkey — must use their API for key provisioning
- **MCP protocol**: Standard MCP over HTTP with Bearer auth at api.thecontext.company/mcp
- **Slack**: Existing OAuth flow in context repo — remove Pro plan requirement, keep architecture
- **Package managers**: Must detect and use npm/yarn/pnpm/bun for TS, pip/poetry/uv for Python
- **Node version**: >=18.0.0
- **No breaking changes**: Existing SDK packages are stable, liftoff wraps them

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Rename to @contextcompany/liftoff | Fresh brand, "liftoff" conveys the zero-to-value promise | -- Pending |
| Localhost callback for CLI auth | Fast UX like vercel/stripe login, simplest to implement | -- Pending |
| Provision both key types | Org prod key for instrumentation + user readonly for MCP = complete setup in one flow | -- Pending |
| Auto-detect, then confirm | Respect user's time; only ask if ambiguous | -- Pending |
| Full vision v1 | Ship auth + detect + install + instrument + gotchas + metadata + MCP + Slack + first win together | -- Pending |
| Remove Slack Pro plan gate | Free users get limited Slack reports — onboarding hook | -- Pending |
| TS + Python in v1 | Complete framework coverage from day one | -- Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-30 after initialization*

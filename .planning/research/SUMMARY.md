# Project Research Summary

**Project:** @contextcompany/liftoff
**Domain:** CLI onboarding wizard for AI observability SDK
**Researched:** 2026-03-30
**Confidence:** HIGH

## Executive Summary

Liftoff is a CLI onboarding wizard that takes developers from zero to full AI observability in under two minutes. The best CLI wizards in this space (Sentry Wizard, Vercel CLI, Stripe CLI) share a common pattern: auto-detect everything possible, confirm with the user in one consolidated prompt, execute the entire plan with progress display, and end with immediate proof of value. Liftoff should follow this pattern exactly, with two unique differentiators no competitor offers: automatic MCP editor configuration (connecting AI coding assistants to observability data) and browser-based OAuth that provisions API keys without ever asking the user to visit a dashboard.

The recommended approach is a step pipeline architecture with a shared WizardContext that accumulates state across six phases: detection, auth, provisioning, instrumentation, integration, and completion. The stack is intentionally minimal -- 7 runtime dependencies, all pure JS/ESM, zero native modules. The most consequential technical decision is authentication: the STACK research strongly recommends the OAuth 2.0 Device Authorization Flow (used by GitHub CLI, Stripe CLI, and Vercel CLI post-2025) over the localhost callback approach mentioned in PROJECT.md. Device flow is more reliable across SSH, WSL, Docker, and Codespaces environments, requires no localhost server, and needs no client secret in the distributed binary.

The primary risks are: (1) OAuth flow failures killing first impressions -- the auth step is the first thing users experience and has the most documented failure modes across real CLI tools, (2) MCP config fragmentation across editors with no standard schema, requiring per-editor adapters, and (3) string-based code modification breaking on non-standard project layouts. All three are mitigable with the patterns identified in research: server-first startup for OAuth, read-merge-write for MCP configs, and a "create new files, don't modify existing" strategy for instrumentation.

## Key Findings

### Recommended Stack

The stack is deliberately minimal with 7 runtime dependencies, all ESM-only and pure JavaScript. The existing tooling (@clack/prompts, picocolors, tsup, TypeScript) is well-chosen and should not change. Key additions are `open` (browser launch), `execa` (subprocess execution), `conf` (config storage), and `@unkey/api` (key provisioning). See STACK.md for full details.

**Core technologies:**
- **@clack/prompts**: Interactive wizard UI -- already in use, beautiful connected-step flow, built-in spinners
- **WorkOS Device Code Flow (raw HTTP)**: Browser-based CLI auth -- no client secret needed, works through firewalls/SSH/WSL/Docker, 3 HTTP calls total
- **execa**: Subprocess execution -- runs package manager install commands (npm/yarn/pnpm/bun/pip/poetry/uv)
- **@unkey/api**: API key provisioning -- project constraint, type-safe SDK for creating org prod and user readonly keys
- **conf**: Persistent config -- XDG-compliant config storage for tokens and preferences
- **open**: Browser launch -- cross-platform, ESM-only, de facto standard

**Critical decision: Device Code Flow over Localhost Callback.** STACK.md documents that Vercel CLI itself moved away from localhost callbacks to device flow in 2025. PITFALLS.md documents multiple real-world failure modes with localhost callbacks (Safari DNS resolution, port conflicts, SSH/container environments). Device flow should be primary, with localhost callback as an optional optimization for local environments only.

### Expected Features

**Must have (table stakes):**
- Framework auto-detection with confirmation (not forced selection)
- Package manager detection and automatic dependency installation
- Instrumentation file creation via deterministic templates (not AI-generated)
- Config file modification (next.config.js, etc.) with idempotent re-runs
- API key handling via three paths: --key flag, existing .env, or OAuth provisioning
- Clean Ctrl+C handling, progress spinners, and a success summary with next steps

**Should have (differentiators):**
- Browser OAuth login with automatic API key provisioning (THE key differentiator)
- MCP editor setup for Cursor, Claude Code, Windsurf, VS Code (unique to TCC)
- Framework gotcha auto-fixes (experimental_telemetry, instrumentationHook)
- Deep-link to dashboard with pre-built insight patterns
- Git-aware safety checks (warn on dirty working tree)
- Dry-run mode and CI/non-interactive mode

**Defer (v2+):**
- Slack integration in CLI (high complexity, requires admin approval handling, can be done from dashboard)
- Monorepo detection and multi-project setup
- Custom event scaffolding and upgrade wizard
- Python framework support (same architecture, different templates -- add after TS is solid)

### Architecture Approach

The CLI is a stateful step pipeline that accumulates a WizardContext object through six phases. Each step is an independent async function with a `shouldRun` predicate for conditional execution (skip auth if --key provided, skip Slack if no session). The CLI-to-server boundary is intentionally thin: exactly two API endpoints in the context repo (auth token exchange, key provisioning). Everything else is local filesystem operations. See ARCHITECTURE.md for the full WizardContext interface and API contracts.

**Major components:**
1. **Pipeline Runner** (pipeline.ts) -- Executes steps in order, manages WizardContext, handles cancellation and skip logic
2. **Detector** (detect/) -- Framework, language, package manager, and project structure detection from filesystem signals
3. **Auth Client** (auth/) -- Device code flow with WorkOS, token exchange via context server
4. **Instrumentor** (instrument/) -- Package installation, file creation, gotcha fixes, metadata hooks -- per-framework strategy pattern
5. **MCP Configurator** (integrations/mcp.ts) -- Per-editor adapter for detecting and writing MCP config
6. **API Client** (api/) -- Typed HTTP client for the two server endpoints

### Critical Pitfalls

1. **OAuth callback race condition** -- If using localhost callback, the server MUST be listening before the browser opens. Use 127.0.0.1 (not localhost), bind to port 0, set a 60-second timeout. Device flow avoids this entirely.
2. **Overwriting existing .env values** -- Check if TCC_API_KEY already exists. If so, show the masked value and ask before replacing. Default to keeping the existing key. Priority: --key flag > existing env > OAuth-provisioned.
3. **Monorepo false positives** -- Check for `workspaces` field in package.json or `pnpm-workspace.yaml`. If found, warn the user to run from the specific package directory. When multiple frameworks detected, present all and ask user to pick.
4. **MCP config clobbering** -- NEVER overwrite the entire config file. Read existing JSON, deep-merge, write back. Handle JSONC (comments, trailing commas). Claude Code requires `claude mcp add` CLI command, not file writes.
5. **npx cold start delay** -- Keep dependencies minimal, use dynamic imports for step-specific packages, show banner output BEFORE heavy imports resolve. Bundle to single file with tsup.

## Implications for Roadmap

Based on combined research, here is the suggested phase structure. The ordering follows the dependency chain from ARCHITECTURE.md's build order and FEATURES.md's dependency graph.

### Phase 1: Foundation and Pipeline

**Rationale:** Everything else depends on the step pipeline infrastructure and extended type system. The current monolithic run.ts must be refactored into testable steps before adding new capabilities. This is Layer 0 from ARCHITECTURE.md.
**Delivers:** Step pipeline runner, extended WizardContext type, CLI entry point with flag parsing, API client skeleton
**Addresses:** Clean cancel handling, progress indicators, --key flag bypass
**Avoids:** Monolithic run function anti-pattern, state loss on re-run (idempotent step design from day one)

### Phase 2: Detection Hardening

**Rationale:** Detection is the foundation for all downstream phases. The current detection works for single TypeScript projects but needs hardening for monorepos and extension for Python. This is Layer 1 from ARCHITECTURE.md.
**Delivers:** Robust framework detection with monorepo awareness, Python project detection (pyproject.toml/requirements.txt/uv.lock/poetry.lock), package manager detection for Python ecosystem
**Addresses:** Framework auto-detection, package manager detection
**Avoids:** Monorepo false positives, Python detection edge cases (virtualenvs, fragmented packaging)

### Phase 3: Authentication and Key Provisioning

**Rationale:** Auth is the highest-complexity, highest-risk feature and THE key differentiator. It requires coordinated work across both repos (CLI + server endpoints). Must be built early because MCP setup and Slack depend on it. This is Layer 2 from ARCHITECTURE.md.
**Delivers:** Device code flow with WorkOS, token exchange endpoint (context repo), key provisioning endpoint (context repo), .env writing with existing-value protection, --key flag bypass path
**Addresses:** Browser OAuth login, API key provisioning, .env file write
**Avoids:** OAuth callback race conditions, .env value overwriting, secrets in CLI binary, orphaned keys on re-run

### Phase 4: Instrumentation and Gotcha Fixes

**Rationale:** This is the core value delivery -- installing packages and creating instrumentation files. Depends on detection (Phase 2) for framework knowledge and provisioning (Phase 3) for API keys to write to .env. This is Layer 3 from ARCHITECTURE.md.
**Delivers:** Per-framework instrumentation file templates (TS frameworks first), config file modification (next.config.js, etc.), framework gotcha auto-fixes, metadata hook injection
**Addresses:** Dependency installation, instrumentation file creation, config file modification, framework gotcha fixes, metadata hooks
**Avoids:** String-based code modification failures (prefer creating new files over modifying existing ones, show diff preview for modifications)

### Phase 5: MCP Editor Integration

**Rationale:** MCP setup is a unique differentiator that requires the readonly API key from Phase 3. Each editor needs its own adapter due to config fragmentation. This is Layer 4 from ARCHITECTURE.md.
**Delivers:** Editor detection (Cursor, Claude Code, Windsurf, VS Code), per-editor config writing with merge semantics, Claude Code CLI command integration
**Addresses:** MCP editor setup
**Avoids:** MCP config clobbering, schema differences across editors, hardcoded config paths

### Phase 6: Completion, Polish, and Post-Launch

**Rationale:** The success summary and deep-link are the "aha moment." This phase also adds polish features (dry-run, CI mode) and deferred features (Slack, Python templates). This is Layer 5 from ARCHITECTURE.md plus v1.x features from FEATURES.md.
**Delivers:** Success summary with actionable next steps, deep-link to dashboard, dry-run mode, CI/non-interactive mode, git-aware safety check
**Addresses:** Success summary, deep link, dry-run, CI mode, git-aware safety
**Avoids:** npx cold start delay (final optimization pass), Slack admin approval blocking (defer to dashboard)

### Phase Ordering Rationale

- **Phase 1 before everything:** Pipeline infrastructure is the skeleton that all features plug into. Building features without it leads to the existing monolithic pattern.
- **Phase 2 and 3 can partially overlap:** Detection and auth have no dependency on each other (ARCHITECTURE.md Layer 1 and Layer 2 are parallel). However, Phase 3 requires the server endpoints, which is cross-repo coordination -- start early.
- **Phase 4 after 2 and 3:** Instrumentation needs both framework knowledge (from detection) and API keys (from provisioning) to write complete .env files.
- **Phase 5 after 3:** MCP config needs the readonly key from provisioning.
- **Phase 6 last:** Polish and deferred features after core flow works end-to-end.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Auth):** The device flow vs. localhost callback decision has significant implementation differences. WorkOS-specific device flow API surface needs validation. Cross-repo API contract must be defined before implementation begins.
- **Phase 5 (MCP):** Editor config paths and schemas change between versions. Claude Code uses a CLI command, not a file. Current documentation is sparse and evolving. Needs hands-on testing with each editor.

Phases with standard patterns (skip deep research):
- **Phase 1 (Foundation):** Step pipeline is a well-documented pattern. The existing codebase provides a clear starting point.
- **Phase 2 (Detection):** File-based detection is straightforward. The monorepo handling is documented in Turborepo and pnpm workspace docs.
- **Phase 4 (Instrumentation):** The existing codebase already has per-framework setup files. This is extending an established pattern.
- **Phase 6 (Completion):** Standard CLI polish. No novel patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies are well-established, most already in use. Device flow recommendation backed by multiple industry examples (Vercel, GitHub, Stripe). |
| Features | HIGH | Competitor analysis covers 6 major CLI tools. Table stakes vs. differentiators clearly delineated. |
| Architecture | HIGH | Step pipeline pattern is proven. WizardContext accumulation is the existing pattern extended. Cross-repo API surface is small (2 endpoints). |
| Pitfalls | HIGH | Most pitfalls verified against real GitHub issues from Claude Code, GitHub CLI, npm CLI, and Turborepo. Specific prevention strategies provided. |

**Overall confidence:** HIGH

### Gaps to Address

- **WorkOS Device Flow API specifics:** The exact endpoint paths and response formats for WorkOS device code flow need validation against current WorkOS docs. The STACK research is confident the pattern is supported but the specific API surface was not fully mapped.
- **Auth flow decision (device flow vs. PKCE localhost):** STACK.md recommends device flow; ARCHITECTURE.md recommends localhost PKCE. The research is internally split. Recommendation: go with device flow as primary (STACK.md rationale is stronger -- real-world migration by Vercel, broader environment support), implement localhost as optional fast-path.
- **Context repo readiness:** Two new API endpoints are needed in the context repo. The scope is well-defined but the implementation timeline and any existing API patterns in that repo were not researched.
- **Python framework template content:** Detection strategy for Python is well-researched. The actual instrumentation file templates for Python frameworks (LangChain, CrewAI, Agno) were not covered in this research -- they depend on the existing Python SDK patterns.
- **Slack integration complexity:** Deferred to v1.x, but the OAuth flow with admin approval handling, pro-gate removal, and subscription setup is a significant feature that will need its own research when prioritized.

## Sources

### Primary (HIGH confidence)
- [WorkOS CLI Auth docs](https://workos.com/docs/authkit/cli-auth) -- Device authorization flow
- [WorkOS AuthKit PKCE docs](https://workos.com/docs/reference/authkit/authentication/get-authorization-url/pkce) -- PKCE flow specifics
- [Sentry Wizard GitHub](https://github.com/getsentry/sentry-wizard) -- Architecture, precondition checking
- [Sentry SDK Setup Wizards Dev Docs](https://develop.sentry.dev/sdk-setup-wizards/) -- Expected wizard behaviors
- [@clack/prompts npm](https://www.npmjs.com/package/@clack/prompts) -- CLI prompt library
- [@unkey/api npm](https://www.npmjs.com/package/@unkey/api) -- API key management
- [Vercel CLI changelog: Device Flow migration](https://vercel.com/changelog/new-vercel-cli-login-flow) -- Industry validation

### Secondary (MEDIUM confidence)
- [PostHog Wizard GitHub](https://github.com/PostHog/wizard) -- AI-powered approach comparison
- [PostHog Blog: LLM Code Generation at Scale](https://posthog.com/blog/correct-llm-code-generation) -- Deterministic vs AI codegen
- [Stripe CLI Docs](https://docs.stripe.com/stripe-cli) -- Login flow, device verification
- [Claude Code OAuth issues](https://github.com/anthropics/claude-code/issues/1529) -- Localhost callback failures
- [GitHub CLI OAuth issues](https://github.com/cli/cli/issues/773) -- Localhost auth failures
- [MCP setup guide](https://help.yourgpt.ai/article/mcp-setup-guide-for-claude-desktop-cursor-and-windsurf-1789) -- Editor config paths

### Tertiary (LOW confidence)
- [kriasoft/oauth-callback](https://github.com/kriasoft/oauth-callback) -- Lightweight OAuth callback handler (useful if localhost approach chosen)
- [Nango OAuth blog posts](https://nango.dev/blog/why-is-oauth-still-hard/) -- General OAuth complexity context

---
*Research completed: 2026-03-30*
*Ready for roadmap: yes*

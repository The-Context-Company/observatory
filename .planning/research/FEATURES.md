# Feature Research

**Domain:** CLI onboarding wizard for AI observability SDK
**Researched:** 2026-03-30
**Confidence:** HIGH (based on analysis of Sentry Wizard, PostHog Wizard, Vercel CLI, Stripe CLI, Railway CLI, Supabase CLI)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels broken, not incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Framework auto-detection** | Sentry, PostHog, and Vercel all do this. Manual selection feels like 2018. | LOW | Detect from package.json/pyproject.toml. Pre-select and confirm, never force manual choice. Current init already does this well. |
| **Package manager detection** | npm/yarn/pnpm/bun/pip/poetry/uv -- users expect the wizard to use whatever they already use. Wrong manager = immediate distrust. | LOW | Already implemented in init. Extend for Python. |
| **Dependency installation** | Sentry wizard installs packages automatically. Asking users to manually `npm install` after a setup wizard is a broken promise. | LOW | Run install command as a subprocess with spinner. |
| **Instrumentation file creation** | Sentry creates sentry.client.config.ts, sentry.server.config.ts etc. PostHog creates provider components. This IS the wizard's job. | MEDIUM | Already partially built. Must be deterministic, not AI-generated -- Sentry's template approach is more reliable than PostHog's LLM approach for core files. |
| **Config file modification** | Sentry modifies next.config.js. PostHog modifies next.config.js. Users expect the wizard to handle framework config, not leave a TODO. | MEDIUM | AST transforms or regex-based patching of next.config.js, vite.config.ts, etc. High-risk area -- must be idempotent. |
| **API key handling** | Every CLI (Stripe, Vercel, Sentry) handles auth/keys. Asking users to go to a dashboard, copy a key, and paste it back is friction that kills conversion. | MEDIUM | Accept via --key flag, read from .env, or provision via OAuth. All three paths needed. |
| **Clean cancel/exit** | Ctrl+C should leave no mess. Sentry checks for clean git state first. Users must trust the wizard won't corrupt their project. | LOW | @clack/prompts handles this. Add file cleanup on SIGINT. |
| **Progress indicators** | Spinners for each step (installing packages, creating files, configuring). No output for >2 seconds = "is it broken?" | LOW | @clack/prompts spinner. Show step-by-step: "Installing @contextcompany/otel... done" |
| **Success summary** | What changed, what was created, what to do next. Sentry and PostHog both print this. Without it, users don't know if it worked. | LOW | Print: files created, packages installed, env vars set, next command to run. |
| **Idempotent re-runs** | Running the wizard twice shouldn't break things. Detect existing setup, skip or update. Sentry checks preconditions. | MEDIUM | Check for existing instrumentation files, .env keys, installed packages before acting. |

### Differentiators (Competitive Advantage)

Features that make users say "oh shit, this is good." Not expected, but create delight.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Browser-based OAuth login** | `vercel login` opens browser, authenticates, returns to CLI seamlessly. No copy-paste key dance. Going from `npx @contextcompany/liftoff` to authenticated in 10 seconds is magic. Sentry still asks you to paste a token. | HIGH | Localhost HTTP server, open browser to WorkOS AuthKit, receive callback with token. This is the single biggest UX differentiator over Sentry/PostHog. |
| **Automatic API key provisioning** | After OAuth, provision keys via Unkey automatically. User never visits a dashboard settings page. Stripe does this with `stripe login` generating restricted keys. | MEDIUM | Requires API endpoint in context repo. Two keys: org prod key (TCC_API_KEY) + user readonly key (for MCP). Write to .env automatically. |
| **Framework gotcha auto-fixes** | AI SDK requires `experimental_telemetry: { isEnabled: true }` everywhere. Next.js needs `instrumentationHook: true`. These gotchas are invisible until traces don't appear. Fixing them automatically = "how did it know?" | MEDIUM | Maintain a curated list of framework-specific gotchas. AST-transform or template-based fixes. This is where domain expertise shows. |
| **MCP editor setup** | Detect Cursor/Claude Code/Windsurf/OpenCode, write MCP config pointing to api.thecontext.company/mcp with readonly key. Developer's AI coding assistant immediately has observability context. No other observability tool does this. | MEDIUM | Detect ~/.cursor/mcp.json, ~/.config/claude/claude_desktop_config.json etc. Write/merge MCP server config. Unique to TCC -- nobody else connects their CLI setup to AI coding tools. |
| **Slack integration in CLI** | Walk through Slack workspace connection, channel selection, /subscribe. Alerts configured before user writes a single line of code. PostHog and Sentry send you to a web dashboard for this. | HIGH | OAuth flow for Slack in CLI (browser redirect). Requires removing Pro plan gate. High complexity but high payoff -- alerts from minute zero. |
| **Deep-link to first insight** | After setup, open browser to dashboard pre-loaded with built-in patterns (frustration, confusion, task failure). User sees value before they even deploy. Stripe does this with test mode + triggers. | LOW | Construct URL with org/project params, open browser. Simple but psychologically powerful -- the "aha" moment. |
| **Metadata hooks auto-injection** | Auto-add tcc.conversational, tcc.sessionId, userId/orgId capture to instrumentation. These are the hooks that make observability actually useful, not just "traces exist." | MEDIUM | Template-based injection. Must understand framework patterns (Next.js middleware for userId, session context for sessionId). |
| **Git-aware safety** | Like Sentry: check for clean git state, warn if dirty. After setup, user can `git diff` to see exactly what changed. Builds trust. | LOW | `git status --porcelain` check. Warn but don't block (some users don't use git). |
| **Dry-run mode** | `--dry-run` flag that shows what WOULD change without changing anything. Power user feature. Expo upgrade wizard has this. Builds trust for cautious developers. | LOW | Run all detection and planning, print changes, skip file writes and installs. |
| **Non-interactive/CI mode** | `--ci` flag for automated environments. PostHog wizard supports this. Essential for teams that want to add TCC to project templates. | LOW | Accept all options as flags: --framework, --key, --skip-slack, --skip-mcp. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **AI-powered code generation for instrumentation** | PostHog uses Claude to generate integration code. Sounds magical. | PostHog's own blog admits LLMs are non-deterministic. Their wizard takes ~8 minutes. Sentry's deterministic templates are faster and more reliable. For core instrumentation files, templates win. AI introduces unpredictability in the one moment trust matters most. | Use deterministic templates for instrumentation files. Reserve AI for the MCP server (where it analyzes traces, not generates setup code). |
| **Interactive tutorial/walkthrough after setup** | "Teach me how to use the dashboard" | The CLI is the wrong medium for tutorials. Users want to be DONE with the terminal and start building. A tutorial adds minutes to time-to-value. | Deep-link to dashboard with contextual onboarding there. Print one clear "next step" command. |
| **Automatic code refactoring** | "Wrap all my AI calls with observability" | Modifying existing business logic is dangerous and error-prone. High risk of breaking user code. Even PostHog's AI approach only adds new files, not refactoring existing ones. | Create new instrumentation files that hook into framework lifecycle. Never modify user's application code beyond config files. |
| **Multi-project setup** | "Set up observability for my monorepo's 5 services" | Scope explosion. Each project has different frameworks, configs, gotchas. Trying to handle all at once = brittle and confusing. | Handle one project root at a time. Users can run liftoff in each service directory. Simple, predictable. |
| **Custom dashboard creation from CLI** | "Create my first dashboard during setup" | Dashboard preferences are personal. Creating a generic dashboard wastes a step and the dashboard probably won't match what the user wants. | Deep-link to dashboard with pre-built patterns (frustration, confusion, task failure). Let the dashboard's own onboarding handle customization. |
| **Version pinning / lock file management** | "Pin exact SDK versions" | Package managers already handle this via lockfiles. The wizard adding version pinning logic duplicates work and can conflict with user's dependency strategy. | Install packages normally. Let npm/yarn/pnpm handle version resolution. |
| **Ejectable config** | "Let me eject from the wizard's config" | Implies the wizard creates an abstraction layer. It shouldn't. The wizard should create standard config files that users already know how to edit. | Generate plain instrumentation files using standard SDK APIs. No wrapper, no abstraction, no "eject" needed. |

## Feature Dependencies

```
[Browser OAuth Login]
    |
    v
[API Key Provisioning] -----> [.env File Write]
    |                              |
    v                              v
[MCP Editor Setup]           [Package Installation]
    (needs readonly key)          |
                                  v
                             [Instrumentation File Creation]
                                  |
                                  v
                             [Config File Modification]
                                  |
                                  v
                             [Framework Gotcha Fixes]
                                  |
                                  v
                             [Metadata Hook Injection]
                                  |
                                  v
                             [Success Summary + Deep Link]

[Slack Integration] -----> [Requires OAuth infrastructure from Browser OAuth]

[Framework Auto-Detection] -----> [Everything else depends on this]

[Git-Aware Safety] -----> [Runs BEFORE any file changes]
```

### Dependency Notes

- **API Key Provisioning requires Browser OAuth**: Can't provision keys without authenticating the user first. The --key flag is the escape hatch for users who already have keys.
- **MCP Editor Setup requires API Key Provisioning**: Needs the readonly key to write into MCP config. Must come after key provisioning or --key flag.
- **Instrumentation File Creation requires Package Installation**: Files import from SDK packages that must be installed first.
- **Framework Gotcha Fixes require Instrumentation File Creation**: Gotchas are fixes to the instrumentation and framework config already in place.
- **Slack Integration requires OAuth infrastructure**: Reuses the browser-based OAuth pattern from login, but against Slack's OAuth. Can be built independently but shares the localhost-callback pattern.
- **Deep Link requires API Key**: Dashboard URL needs org/project context from the authenticated session.
- **Git-Aware Safety conflicts with nothing**: It's a precondition check that runs first, before any mutations.

## MVP Definition

### Launch With (v1)

Minimum viable product -- what gets a developer from zero to observability in under 2 minutes.

- [ ] **Framework auto-detection + confirmation** -- foundation for everything else
- [ ] **Package manager detection + auto-install** -- no manual npm install steps
- [ ] **Browser OAuth login** -- THE differentiator; no copy-paste key dance
- [ ] **API key provisioning (both prod + readonly)** -- complete auth in one flow
- [ ] **.env file write** -- keys land where the SDK expects them
- [ ] **Instrumentation file creation** -- deterministic templates per framework
- [ ] **Config file modification** -- next.config.js, etc.
- [ ] **Framework gotcha auto-fixes** -- experimental_telemetry, instrumentationHook, etc.
- [ ] **Metadata hook injection** -- sessionId, userId, tcc.conversational
- [ ] **MCP editor setup** -- detect editors, write config with readonly key
- [ ] **Success summary + deep link to dashboard** -- the "aha" moment
- [ ] **Git-aware safety check** -- warn on dirty state, build trust
- [ ] **Progress indicators** -- spinner per step via @clack/prompts
- [ ] **Clean cancel handling** -- Ctrl+C leaves no mess
- [ ] **--key flag bypass** -- skip OAuth for users with existing keys
- [ ] **Idempotent re-runs** -- detect existing setup, skip or update

### Add After Validation (v1.x)

Features to add once core flow is proven and users are completing setup.

- [ ] **Slack integration** -- add when OAuth infrastructure is stable and proven via login flow
- [ ] **Dry-run mode (--dry-run)** -- add when users report hesitation about running the wizard
- [ ] **Non-interactive/CI mode (--ci)** -- add when teams want to automate onboarding across projects
- [ ] **Python framework support** -- add after TS frameworks are solid; same architecture, different templates

### Future Consideration (v2+)

- [ ] **Monorepo detection** -- auto-discover multiple service roots; defer until single-project flow is bulletproof
- [ ] **Custom event scaffolding** -- generate typed event helpers; defer until users are past basic setup
- [ ] **Upgrade wizard** -- migrate between SDK versions; defer until there are versions to migrate between

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Framework auto-detection | HIGH | LOW | P1 |
| Package manager detection + install | HIGH | LOW | P1 |
| Browser OAuth login | HIGH | HIGH | P1 |
| API key provisioning | HIGH | MEDIUM | P1 |
| Instrumentation file creation | HIGH | MEDIUM | P1 |
| Config file modification | HIGH | MEDIUM | P1 |
| Framework gotcha auto-fixes | HIGH | MEDIUM | P1 |
| Metadata hook injection | MEDIUM | MEDIUM | P1 |
| MCP editor setup | HIGH | MEDIUM | P1 |
| Deep link to dashboard | HIGH | LOW | P1 |
| Success summary | HIGH | LOW | P1 |
| Git-aware safety | MEDIUM | LOW | P1 |
| .env file write | HIGH | LOW | P1 |
| Idempotent re-runs | MEDIUM | MEDIUM | P1 |
| Slack integration | MEDIUM | HIGH | P2 |
| Dry-run mode | LOW | LOW | P2 |
| CI/non-interactive mode | MEDIUM | LOW | P2 |
| Python support | HIGH | MEDIUM | P2 |
| Monorepo detection | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch -- the 2-minute zero-to-value promise
- P2: Should have, add when core is proven
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Sentry Wizard | PostHog Wizard | Vercel CLI | Stripe CLI | Our Approach (Liftoff) |
|---------|---------------|----------------|------------|------------|------------------------|
| **Auth method** | Paste token from dashboard | API key flag or prompt | Browser OAuth (magic) | Browser OAuth (magic) | Browser OAuth -- match the gold standard |
| **Framework detection** | Yes, checks versions | Yes, AI-enhanced | Yes, for deploy settings | N/A (API tool) | Yes, deterministic detection + confirm |
| **Code generation** | Deterministic templates | AI (Claude) -- ~8 min | N/A | N/A | Deterministic templates -- fast and reliable |
| **Config modification** | Yes (next.config.js, vite.config) | Yes (via AI) | Auto-detected | N/A | Yes, AST-based when possible |
| **Git state check** | Yes, requires clean state | No | No | No | Yes, warn but don't block |
| **Key provisioning** | No (paste existing) | No (paste existing) | Yes (via login) | Yes (generates restricted keys) | Yes, auto-provision both key types |
| **Editor/IDE setup** | No | Cursor rules file | No | No | MCP config for all major AI editors -- unique |
| **Slack/notifications** | No (dashboard only) | No (dashboard only) | No | No | Yes, in-CLI Slack setup -- unique |
| **Deep link post-setup** | Example error page | No | Opens dashboard | Test mode fixtures | Dashboard with pre-built insight patterns |
| **Dry run** | No | No | Yes (--dry-run) | No | Yes (planned v1.x) |
| **CI mode** | Quiet mode (--quiet) | Yes (--ci) | Yes | Yes | Yes (planned v1.x) |
| **Time to complete** | ~1-2 min | ~8 min (AI) | ~30 sec | ~30 sec | Target: <2 min |
| **Idempotent** | Partial | No | Yes | N/A | Yes, detect and skip existing setup |

### What Makes the Best Ones Feel Magical

**Vercel CLI** -- The browser OAuth flow. You type `vercel login`, browser opens, you click "Authorize," and the CLI just... knows. No copy-paste. No token. No "go to settings and find your API key." It respects your time.

**Stripe CLI** -- The `stripe trigger` command. After setup, you can immediately fire test events and see them flow through. Instant proof the integration works. The webhook forwarding (`stripe listen`) turns the CLI into a development companion, not just a setup tool.

**Sentry Wizard** -- The precondition checking and git-awareness. It checks your git state is clean before modifying files. It checks your framework version is supported. It tells you exactly which files it will create. This builds trust. The example error page it generates lets you immediately verify Sentry works -- proof of value in the first minute.

**Railway CLI** -- Zero config deploys. `railway up` just works. No YAML, no Dockerfile, no build config. The magic is in how much it figures out without asking.

**The pattern across all of them:** The magic is proportional to the ratio of (value delivered) / (questions asked). The best tools detect everything they can, confirm with the user in one consolidated prompt, then execute the entire plan with a progress display. The worst ones ask 15 questions, then tell you to go do 5 manual steps.

## Sources

- [Sentry Wizard GitHub](https://github.com/getsentry/sentry-wizard) -- architecture, precondition checking, framework support
- [Sentry SDK Setup Wizards Dev Docs](https://develop.sentry.dev/sdk-setup-wizards/) -- expected wizard behaviors and UX principles
- [PostHog Wizard GitHub](https://github.com/PostHog/wizard) -- AI-powered approach, framework support
- [PostHog Blog: LLM Code Generation at Scale](https://posthog.com/blog/correct-llm-code-generation) -- lessons on deterministic vs AI codegen
- [Vercel CLI Login Docs](https://vercel.com/docs/cli/login) -- browser OAuth flow
- [Vercel CLI Deploy Docs](https://vercel.com/docs/cli/deploy) -- auto-detection, smart defaults
- [Stripe CLI Docs](https://docs.stripe.com/stripe-cli) -- login flow, webhook forwarding, triggers
- [Railway CLI Docs](https://docs.railway.com/cli/deploying) -- zero-config deploy experience
- [Supabase CLI Docs](https://supabase.com/docs/guides/local-development/cli/getting-started) -- init flow, config generation
- [CLI UX Best Practices: Progress Displays](https://evilmartians.com/chronicles/cli-ux-best-practices-3-patterns-for-improving-progress-displays) -- spinner, X of Y, progress bar patterns
- [clig.dev Command Line Interface Guidelines](https://clig.dev/) -- CLI UX standards

---
*Feature research for: CLI onboarding wizard for AI observability SDK*
*Researched: 2026-03-30*

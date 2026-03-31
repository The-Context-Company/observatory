# Pitfalls Research

**Domain:** CLI onboarding wizard (browser OAuth, framework detection, code modification, cross-editor config, Slack OAuth)
**Researched:** 2026-03-30
**Confidence:** HIGH (most pitfalls verified against real-world CLI tools and official docs)

## Critical Pitfalls

### Pitfall 1: OAuth callback server not ready when browser redirects

**What goes wrong:**
The CLI opens a browser to the WorkOS auth page, but the localhost HTTP server that catches the callback is not yet listening. The browser redirects to `http://localhost:<port>/callback`, gets "connection refused", and the user sees a dead page. They have no idea what happened or what to do next. This is the single most common CLI OAuth failure mode -- documented in Claude Code, GitHub CLI, Bitbucket, and many others.

**Why it happens:**
Race condition: browser opens (async) before `server.listen()` resolves. On slow machines or when the default browser takes time to launch, the timing varies. Also, some implementations `await` the browser open before starting the server, which is backwards.

**How to avoid:**
1. Start the HTTP server FIRST. Wait for the `listening` event.
2. Only THEN open the browser (and do NOT await the browser open -- it is fire-and-forget).
3. Use `127.0.0.1` explicitly, not `localhost` (Safari on macOS sometimes fails to resolve `localhost` to the loopback address -- this is a documented Claude Code issue).
4. Bind to port 0 and let the OS assign a free port, then pass that port in the redirect URI.
5. Set a hard timeout (60 seconds) on the server -- if no callback arrives, print a manual URL the user can paste.

**Warning signs:**
- Works on your machine but users report "localhost refused to connect" in issue tracker
- Safari users specifically reporting failures
- CI/container environments hanging forever

**Phase to address:**
Phase 1 (Auth) -- this is the first thing users experience. If it fails, they abandon immediately.

---

### Pitfall 2: WorkOS Device Flow vs. Localhost Callback -- choosing wrong pattern

**What goes wrong:**
WorkOS AuthKit supports two CLI auth patterns: (a) Device Authorization Grant (poll-based, like `gh auth login`) and (b) localhost redirect (like `vercel login`). The PROJECT.md says "localhost callback" but WorkOS has a dedicated Device Flow API that may be more robust. Picking the wrong pattern creates edge-case failures that are hard to fix later.

**Why it happens:**
Localhost callbacks feel simpler but break in: SSH sessions, containers, WSL, Codespaces, and any remote dev environment. Device flow works everywhere because the browser and CLI do not need to be on the same machine.

**How to avoid:**
Implement Device Flow as PRIMARY, with localhost callback as an optimization for local-machine scenarios. WorkOS Device Flow specifics:
- Poll `/token` every 5 seconds (respect the `interval` field in the response)
- Handle `slow_down` error by adding 1 second to interval
- Handle `expired_token` with a clean "timed out, try again" message
- Never display `device_code` to the user -- only display `user_code`
- Set the app as "Public" in WorkOS (no client secret embedded in CLI binary)
- Timeout at `expires_in` value (typically 300 seconds)

Fallback: if the CLI detects it can open a browser on the same machine (not SSH, not container), offer the faster localhost redirect flow. Otherwise, default to device flow.

**Warning signs:**
- Users in remote dev environments (Codespaces, SSH) filing "auth doesn't work" issues
- Polling loop running forever without timeout
- `device_code` accidentally shown in terminal output

**Phase to address:**
Phase 1 (Auth) -- architectural decision that is painful to change later.

---

### Pitfall 3: Overwriting user's existing .env values silently

**What goes wrong:**
The CLI writes `TCC_API_KEY=<new_value>` to `.env` or `.env.local`, but the user already had a `TCC_API_KEY` set (from a previous run, or manually configured). The current `setEnvVariable` in `env.ts` already overwrites existing values via regex replace. If the user had a working key and the CLI replaces it with a new provisioned key, their existing setup breaks silently.

**Why it happens:**
The code treats "upsert" as the default behavior. Developers building the CLI think "we're helping by setting the latest key" but users think "the CLI destroyed my config."

**How to avoid:**
1. Check if `TCC_API_KEY` already exists in `.env` AND is non-empty.
2. If it exists, show the current value (masked: `tcc_prod_...a3f2`) and ASK: "You already have a TCC_API_KEY. Replace it? (y/N)"
3. Default to NO -- respect what is already there.
4. Also check `process.env.TCC_API_KEY` (might be set in shell profile, not in `.env`).
5. The `--key` flag from CLI args should take highest precedence, then existing env, then OAuth-provisioned key.

**Warning signs:**
- Users running liftoff twice get a different API key each time
- "My traces stopped appearing" support tickets after re-running setup
- Key mismatch between what the dashboard shows and what is in `.env`

**Phase to address:**
Phase 2 (Key Provisioning) -- must be correct before any key is written.

---

### Pitfall 4: Framework detection false positives in monorepos

**What goes wrong:**
The current `detectFramework` reads `package.json` from `process.cwd()`. In a monorepo, the user might run `npx @contextcompany/liftoff` from the repo root, which has a `package.json` with `next` as a devDependency (for the docs site) and `@langchain/core` (for the agent package). The CLI detects "Next.js + AI SDK" and instruments the wrong project. Worse: in a monorepo root, there may be NO framework -- it is just a workspace root.

**Why it happens:**
The detection logic checks `dependencies` and `devDependencies` without considering whether the project is a monorepo root (has `workspaces` field). It also does not look at what the user is actually trying to instrument.

**How to avoid:**
1. Check for `workspaces` field in `package.json` (npm/yarn) or existence of `pnpm-workspace.yaml`. If found, warn: "This looks like a monorepo root. Run liftoff from the package you want to instrument."
2. When multiple frameworks are detected (Next.js AND LangChain), present ALL matches and ask the user to pick instead of auto-selecting based on priority order.
3. For Python: check for `pyproject.toml` with `[tool.poetry.packages]` or multiple `[project.scripts]` entries as monorepo signals.
4. Consider walking UP from cwd to find the git root, and DOWN to find the actual application package.

**Warning signs:**
- Users reporting "it detected the wrong framework"
- Instrumentation files created in the wrong directory
- Works perfectly in single-package repos but confuses monorepo users

**Phase to address:**
Phase 2 (Framework Detection) -- detection is the foundation for everything downstream.

---

### Pitfall 5: String-based code modification breaking on non-standard layouts

**What goes wrong:**
The current `injectWidgetIntoLayout` function uses string operations (indexOf, replace, slice) to modify JSX/TSX files. It searches for literal strings like `<head>` and `"from 'next/script'"`. This breaks when:
- The layout uses template literals or string interpolation
- The `<head>` tag has attributes: `<head lang="en">`
- Imports use double vs single quotes inconsistently
- The file uses Prettier-reformatted multi-line JSX
- The file has existing `<Head>` from `next/head` (capital H, different component)

**Why it happens:**
String manipulation is faster to build than AST parsing, but HTML/JSX is not regular -- regex and indexOf cannot handle the combinatorial complexity of real-world code formatting.

**How to avoid:**
For the liftoff wizard, the scope of code modification is limited enough to avoid full AST parsing, but the string approach needs hardening:
1. Use a "create new file, do not modify existing" strategy wherever possible. Creating `instrumentation.ts` (new file) is safe. Modifying `layout.tsx` (existing file) is dangerous.
2. For modifications that MUST touch existing files, show a diff preview and ask for confirmation before writing.
3. If the string patterns do not match, do NOT silently skip. Print the exact manual instructions instead: "Add this to your layout.tsx: [code]".
4. The `experimental_telemetry` gotcha fix (mentioned in PROJECT.md) is especially risky -- it means modifying arbitrary user code files where AI SDK calls live. Consider making this a "print instructions" step rather than an auto-modification.

**Warning signs:**
- "Could not inject widget" appearing frequently in user reports
- Syntax errors in user code after running liftoff
- Layout file modifications that break the user's build

**Phase to address:**
Phase 3 (Instrumentation) -- when the CLI starts writing code to user projects.

---

### Pitfall 6: MCP config files have different schemas across editors

**What goes wrong:**
The CLI writes MCP server config to the wrong file path, wrong JSON structure, or clobbers existing MCP servers the user has configured. Each editor has a completely different config location and potentially different schema:
- Cursor: `~/.cursor/mcp.json` with `{ "mcpServers": { ... } }`
- Claude Code: uses `claude mcp add` CLI command, NOT a JSON file
- Windsurf: `~/.codeium/windsurf/mcp_config.json`
- VS Code: `settings.json` under a specific key
- OpenCode: its own config format

**Why it happens:**
MCP is still young. There is no standard config location or schema. Each editor invented their own. Developers building the CLI test with one editor and assume the others work the same way.

**How to avoid:**
1. Build a per-editor adapter with: config file path, JSON schema, merge strategy, and a "verify it worked" check.
2. For Claude Code specifically, shell out to `claude mcp add` instead of writing JSON -- this is the supported API.
3. NEVER overwrite the entire config file. Read existing JSON, deep-merge the new server entry, write back. If the file has syntax errors (user edited it manually with trailing commas, comments), handle gracefully.
4. After writing, verify: re-read the file and confirm the entry exists.
5. Support `--skip-mcp` flag for users who want to configure manually.
6. Config paths change between editor versions -- do not hardcode. Check if the expected path exists; if not, search common alternatives.

**Warning signs:**
- "My other MCP servers disappeared after running liftoff" -- catastrophic
- Config works in Cursor but not Claude Code
- JSON parse errors because the existing config had comments (JSONC)

**Phase to address:**
Phase 4 (MCP Setup) -- must handle each editor as a separate integration.

---

### Pitfall 7: npx cold start makes the wizard feel broken before it starts

**What goes wrong:**
User runs `npx @contextcompany/liftoff` and waits 10-30 seconds staring at a blank terminal while npm downloads the package and its dependencies. Many users think the command failed and Ctrl+C, or run it again (potentially causing two instances). This is the literal first impression of the product.

**Why it happens:**
npx downloads the entire package tree on first run. If the liftoff package has heavy dependencies (WorkOS SDK, Unkey SDK, HTTP server utils, Slack SDK, framework detection utils), the download is significant. On subsequent runs, npm may still re-verify the cache.

**How to avoid:**
1. Keep the package dependency tree MINIMAL. Lazy-import heavy dependencies only when needed (e.g., do not import Slack SDK until the Slack step).
2. Show output IMMEDIATELY -- even before imports resolve. Print the banner/intro as the first line of the entry point, before any `import` of heavy modules.
3. Use dynamic `import()` for step-specific dependencies so the initial load is fast.
4. Consider bundling with esbuild/tsup to a single file to eliminate node_modules resolution overhead.
5. Test the cold-start experience regularly: `npm cache clean --force && npx @contextcompany/liftoff`.

**Warning signs:**
- Time from `npx` command to first terminal output exceeds 5 seconds
- Users filing "command hangs" issues
- Package size exceeds 5MB unpacked

**Phase to address:**
Phase 1 (Project Setup) -- affects the very first run of the CLI.

---

### Pitfall 8: Slack OAuth requiring the user to be a workspace admin

**What goes wrong:**
The liftoff wizard walks the user through Slack connection, opens a browser to Slack's OAuth consent page, and the user sees "You need to be a workspace admin to install this app" or "Request to install sent to admin." The wizard is now stuck waiting for a callback that will never come (because admin approval is async -- could take days).

**Why it happens:**
Many Slack workspaces have "Require Admin Approval for Apps" enabled. The CLI assumes the user can install a Slack app on their own, but they often cannot.

**How to avoid:**
1. Make Slack setup EXPLICITLY OPTIONAL -- not part of the happy path. Present it as "Want to set up Slack alerts? (you can do this later from the dashboard)".
2. Before opening the Slack OAuth flow, warn: "You may need workspace admin approval. If the install requires approval, you can finish setup later at [dashboard URL]."
3. Set a short timeout (30 seconds) on the Slack callback. If it does not arrive, assume admin approval is needed and gracefully continue.
4. NEVER block the rest of the wizard on Slack completing. Slack should be the LAST step, and failing it should not prevent the user from getting value.
5. Store partial state -- if auth + instrumentation succeeded, the user can add Slack later without re-running the entire wizard.

**Warning signs:**
- Wizard hangs at "Waiting for Slack authorization..." for minutes
- Users Ctrl+C during Slack step and lose all prior progress
- "I can't install Slack apps" support tickets

**Phase to address:**
Phase 5 (Slack Setup) -- must be designed as independently skippable.

---

### Pitfall 9: Python project detection ignoring virtual environments and editable installs

**What goes wrong:**
For Python projects, the CLI needs to detect frameworks from `pyproject.toml`, `requirements.txt`, or `setup.py`. But Python projects frequently have dependencies installed in a virtualenv that is not reflected in any manifest file (user ran `pip install langchain` without adding it to requirements.txt). Conversely, the CLI might detect a `requirements.txt` in a virtualenv's `site-packages` directory, or a `pyproject.toml` that is a build config, not a project config.

**Why it happens:**
Python's packaging ecosystem is fragmented. Unlike Node.js where `package.json` is canonical, Python has: `requirements.txt`, `pyproject.toml` (with Poetry/PDM/Hatch/setuptools backends), `setup.py`, `setup.cfg`, `Pipfile`, and `uv.lock`. Each tool stores dependencies differently.

**How to avoid:**
1. Check files in priority order: `pyproject.toml` > `requirements.txt` > `setup.py` > `Pipfile`.
2. For `pyproject.toml`, parse the `[project.dependencies]` AND `[tool.poetry.dependencies]` sections (they differ).
3. Detect the active virtual environment from `VIRTUAL_ENV` env var. If set, also check `pip list` output for installed packages.
4. Detect the Python package manager: check for `uv.lock` (uv), `poetry.lock` (poetry), `Pipfile.lock` (pipenv), else fall back to pip.
5. Do NOT search recursively -- only check cwd-level files.

**Warning signs:**
- Python users reporting "no framework detected" despite having LangChain installed
- False detection from a `requirements.txt` that was auto-generated or belongs to a subdirectory
- Package installation failing because the wrong package manager was used

**Phase to address:**
Phase 2 (Framework Detection) -- Python detection needs equal rigor to TypeScript detection.

---

### Pitfall 10: Wizard state loss on Ctrl+C or error mid-flow

**What goes wrong:**
User completes OAuth (Phase 1), gets their API key provisioned (Phase 2), framework is detected (Phase 3)... then the package install step fails because of a network error. The user re-runs the wizard and has to do OAuth again, gets a SECOND API key provisioned, and now has orphaned keys in Unkey.

**Why it happens:**
The wizard is stateless -- each run starts from scratch. No progress is persisted between runs. The current `run.ts` is a linear sequence with no checkpointing.

**How to avoid:**
1. Implement idempotent steps: if TCC_API_KEY already exists in `.env` and is valid (quick API call to verify), SKIP auth and key provisioning.
2. Check for existing instrumentation files before creating them (the current code already does this -- good).
3. Check for existing MCP config entries before adding them.
4. At minimum: if `.env` has a valid `TCC_API_KEY`, offer to reuse it instead of re-authenticating.
5. Consider a lightweight state file (`.tcc-setup-state.json`) that tracks which steps completed, but this adds complexity -- the idempotent approach is simpler and more robust.

**Warning signs:**
- Multiple API keys per user in Unkey dashboard
- Users reporting "I had to log in three times"
- Orphaned resources accumulating in the backend

**Phase to address:**
Spans all phases -- each step must be independently idempotent.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| String-based code modification instead of AST | Ships faster, fewer dependencies | Breaks on non-standard formatting, hard to extend to new patterns | MVP only -- move to AST (ts-morph/jscodeshift) for any modifications beyond simple file creation |
| Hardcoded editor config paths | Works for current editor versions | Breaks when editors update config locations | Never -- abstract behind an editor adapter from day one |
| Sync `execSync` for package installation | Simpler code, no async complexity | Blocks the event loop, no progress indication, no timeout control | MVP only -- move to `spawn` with streaming output |
| Single-file wizard with no step isolation | Faster to build | Cannot skip steps, cannot resume, cannot test steps independently | MVP only -- each step should be a separate module by Phase 2 |
| Bundling all SDKs (WorkOS, Unkey, Slack) in main package | One install | Bloats npx cold start, increases attack surface | Never -- dynamic import all SDKs |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| WorkOS AuthKit | Embedding client secret in CLI binary (distributed to users) | Configure WorkOS Connect app as "Public" -- no client secret needed for Device Flow |
| Unkey key creation | Creating keys without metadata, making them unidentifiable later | Always attach metadata: `{ createdBy: "liftoff", userId, orgId, framework, createdAt }` |
| Unkey key creation | Not setting key expiration or permissions | Prod keys: org-scoped, no expiry. MCP readonly keys: user-scoped, no write permissions |
| Slack OAuth | Requesting too many scopes upfront | Request minimal scopes (channels:read, chat:write). Add scopes incrementally. Cannot remove scopes without revoking token entirely |
| Slack OAuth | Not handling the "admin approval required" flow | Detect the `pending_approval` state and gracefully continue the wizard |
| MCP (Claude Code) | Writing a JSON config file | Claude Code uses `claude mcp add` CLI command -- shell out to it |
| MCP (all editors) | Overwriting existing config file | Read, deep-merge new entry, write back. Handle JSONC (comments, trailing commas) |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Logging API keys to terminal in plain text | Key leakage in terminal scrollback, screen recordings, CI logs | Mask keys in all output: show `tcc_prod_...a3f2` (first prefix + last 4 chars only) |
| Storing API keys in non-gitignored files | Keys committed to public repos | Always verify `.gitignore` contains the env file BEFORE writing the key. Current code does this correctly |
| Not validating the OAuth state parameter | CSRF attacks on the localhost callback | Generate a random `state` value, store it, verify it matches on callback. WorkOS Device Flow avoids this entirely |
| Localhost callback server remaining open after auth | Port hijacking if another process binds to the same port | Close the HTTP server within 5 seconds of receiving the callback. Set a max lifetime of 120 seconds |
| MCP readonly key having write permissions | Compromised editor extension could modify production data | Unkey key creation must explicitly set readonly permissions. Verify with a test API call |
| Printing the Unkey root key or using it client-side | Full API access compromise | The CLI backend (context server) provisions keys using the root key. The CLI itself never sees or handles the root key |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Asking too many questions before showing value | User abandons at question 3 of 8 | Auto-detect everything possible. Only ask when ambiguous. Target: 0-1 questions before first action |
| No spinner/progress during package install | User thinks CLI is frozen during 15-second npm install | Use @clack/prompts spinner (already used). Show package names being installed |
| Framework detection fails silently, falls back to "Custom" | User gets wrong instrumentation without realizing | When detection fails, explicitly say "Could not auto-detect your framework" and show the selection menu |
| Browser opens but terminal gives no indication | User switches to browser, forgets about terminal | Print "Waiting for authentication... (press Ctrl+C to cancel)" with a timer |
| Success message without actionable next step | User does not know what to do after wizard completes | Print: exact file to run (`npm run dev`), exact URL to visit (dashboard deep-link), exact thing to look for ("send a message to your agent, then check [URL]") |
| Wizard prints instructions for steps it could not complete | User has to manually do 3 things the wizard promised to automate | If a step fails, either retry or make the manual fallback ONE command, not a paragraph of instructions |
| Error messages showing stack traces | User panics, files a bug report | Catch all errors. Show human-readable message + a debug flag (`--verbose`) for stack traces |

## "Looks Done But Isn't" Checklist

- [ ] **OAuth flow:** Often missing timeout handling -- verify the callback server shuts down after 120s even if no callback arrives
- [ ] **Key provisioning:** Often missing validation -- verify the provisioned key actually works with a test API call before telling the user "you're all set"
- [ ] **Package installation:** Often missing lockfile updates -- verify `package-lock.json` / `yarn.lock` / `pnpm-lock.yaml` was updated (not just `node_modules`)
- [ ] **Instrumentation file:** Often missing framework version compatibility -- verify the import paths match the SDK version installed (not a newer/older API)
- [ ] **.env writing:** Often missing edge case where `.env.local` exists but is a symlink (some Docker setups do this)
- [ ] **MCP config:** Often missing verification that the editor can actually connect to the MCP server after config is written
- [ ] **Slack setup:** Often missing the "subscription" step -- OAuth completes but the user has no active subscriptions, so they never get alerts
- [ ] **Python support:** Often missing venv activation -- packages install to system Python instead of the project's virtualenv
- [ ] **Git state:** Often missing check for dirty working tree -- user runs wizard, creates files, but was in the middle of a commit and now has unexpected changes

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| OAuth callback failure | LOW | Print the manual auth URL. User can paste it in browser and complete auth. Alternatively: `liftoff --key tcc_prod_xxx` to skip auth entirely |
| Wrong framework detected | LOW | Re-run wizard. Instrumentation file can be deleted. Package installation is additive (does not break existing packages) |
| .env key overwritten | MEDIUM | Old key is lost unless user has it elsewhere. User must go to dashboard to find/regenerate the correct key. Prevent by backing up: rename old `.env` to `.env.backup` |
| MCP config clobbered | HIGH | User's other MCP servers are gone. Must manually re-add them. Prevent by ALWAYS merging, never overwriting |
| Slack OAuth stuck in admin approval | LOW | Skip Slack step entirely. User can configure from dashboard later. No data is lost |
| Package install corrupted node_modules | MEDIUM | `rm -rf node_modules && npm install`. Annoying but standard recovery |
| Instrumentation file conflicts with existing | LOW | Delete the generated file. Manual instrumentation instructions are in docs |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| OAuth callback server race condition | Phase 1 (Auth) | Integration test: start server, verify listening, then simulate callback |
| Device Flow vs localhost decision | Phase 1 (Auth) | Test in: local terminal, SSH session, Docker container, Codespaces |
| .env value overwriting | Phase 2 (Key Provisioning) | Test with pre-existing TCC_API_KEY in .env -- wizard must ask before replacing |
| Monorepo false positives | Phase 2 (Framework Detection) | Test in: monorepo root, monorepo package, single-repo, no-framework project |
| String-based code modification | Phase 3 (Instrumentation) | Test against 5+ real-world Next.js layouts with different formatting styles |
| MCP config schema differences | Phase 4 (MCP Setup) | Test write + read-back for each editor. Test merge with existing config |
| npx cold start time | Phase 1 (Project Setup) | Benchmark: `npm cache clean --force && time npx @contextcompany/liftoff` < 8 seconds |
| Slack admin approval blocking | Phase 5 (Slack Setup) | Test with a workspace that has admin approval required. Verify wizard continues |
| Python detection edge cases | Phase 2 (Framework Detection) | Test with: pyproject.toml (Poetry), pyproject.toml (PDM), requirements.txt, no manifest |
| Wizard state loss on re-run | All phases | Run wizard twice. Second run should skip completed steps without creating duplicate resources |

## Sources

- [OAuth callback failure: localhost unreachable on Safari - Claude Code](https://github.com/anthropics/claude-code/issues/1529)
- [OAuth callback server hangs after authorization - Claude Code](https://github.com/anthropics/claude-code/issues/9376)
- [GitHub CLI: authentication fails since it can't access localhost in the browser](https://github.com/cli/cli/issues/773)
- [WorkOS CLI Auth documentation](https://workos.com/docs/authkit/cli-auth)
- [WorkOS CLI Auth blog post](https://workos.com/blog/cli-auth)
- [WorkOS CLI Auth example repo](https://github.com/zackproser-workos/cli-auth-example)
- [Nango: Why OAuth is still hard](https://nango.dev/blog/why-is-oauth-still-hard/)
- [Nango: OAuth redirects on localhost](https://www.nango.dev/blog/oauth-redirects-on-localhost-with-https)
- [kriasoft/oauth-callback: lightweight OAuth code capture for CLI tools](https://github.com/kriasoft/oauth-callback)
- [npx is too slow for cached packages - npm CLI](https://github.com/npm/cli/issues/7295)
- [Slack Installing with OAuth docs](https://docs.slack.dev/authentication/installing-with-oauth/)
- [Turborepo monorepo false positive detection](https://github.com/vercel/turborepo/issues/11144)
- [dotenv: do not overwrite existing env vars - Node.js](https://github.com/nodejs/node/pull/49424)
- [MCP setup guide for Cursor, Windsurf, Claude Desktop](https://help.yourgpt.ai/article/mcp-setup-guide-for-claude-desktop-cursor-and-windsurf-1789)
- [Nobody reads your setup docs - MCP onboarding](https://hanzilla.co/blog/mcp-onboarding-ten-agents-one-command/)

---
*Pitfalls research for: CLI onboarding wizard (@contextcompany/liftoff)*
*Researched: 2026-03-30*

# Technology Stack

**Project:** @contextcompany/liftoff
**Researched:** 2026-03-30

## Recommended Stack

### CLI Framework & Terminal UI

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| @clack/prompts | ^1.1.0 | Interactive wizard prompts, spinners, step flow | Already in use. 4KB gzipped, beautiful connected-step UI, built-in spinner via `p.spinner()`, TypeScript-native, group API for wizard flows. Used by SvelteKit, Astro, and other major CLIs. No reason to switch. | HIGH |
| picocolors | ^1.1.1 | Terminal color output | Already in use. 14x smaller and 2x faster than chalk. 16 colors is plenty for a CLI wizard -- we don't need truecolor. Zero dependencies. | HIGH |

### Authentication (OAuth)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| WorkOS Device Code Flow | N/A (raw HTTP) | Browser-based CLI authentication | WorkOS provides a dedicated Device Authorization Flow endpoint (`/authorize/device`). No client secret needed in distributed CLI binaries (public app). Uses polling, not localhost callback -- more reliable across firewalls, WSL, Docker, and remote SSH. Vercel CLI moved to this same pattern in 2025. No SDK needed -- it's 3 HTTP calls (request device code, poll for token, done). | HIGH |

**Decision: Device Code Flow over Localhost Callback**

The PROJECT.md mentions "localhost callback (like `vercel login`)" but Vercel itself has moved to the OAuth 2.0 Device Authorization Flow as of 2025. The device flow is:
- More reliable: no port conflicts, works through firewalls, WSL, Docker, remote SSH
- More secure: no client secret needed in distributed binary
- Simpler: 3 HTTP endpoints vs spinning up a local HTTP server
- Industry standard: GitHub CLI, Vercel CLI, and Stripe CLI all use device flow now

The UX is equally good: user sees a code, browser opens, they confirm, CLI continues. We should update the project decision to use device flow.

**Fallback consideration:** If WorkOS device flow has any limitation that blocks us, the fallback is a localhost callback using Node's built-in `http.createServer()` + `open` package. No Express needed -- the callback server handles one request and shuts down.

### Token & Config Storage

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| conf | ^15.1.0 | Persistent CLI config (org selection, preferences) | Battle-tested config store used by 3360+ packages. Handles XDG paths, atomic writes, schema validation. Not for secrets -- just preferences and non-sensitive state. | HIGH |
| Node.js fs (built-in) | N/A | Write .env files, read project configs | No library needed. Use `fs.readFileSync`/`fs.writeFileSync` for .env manipulation. Straightforward string operations. | HIGH |

**Token storage strategy:** Store the WorkOS access token and API keys in a `conf` store at `~/.config/contextcompany/config.json` (conf handles XDG automatically). The token is short-lived and refreshable, so OS keychain is overkill for this use case. This matches how Vercel CLI, GitHub CLI, and similar tools store tokens.

### Browser & Process Execution

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| open | ^10.1.0 | Launch browser for OAuth device flow confirmation | De facto standard (sindresorhus). Cross-platform. Used by React scripts, Vite, and nearly every CLI that opens a browser. ESM-only, which is fine -- project is already ESM. | HIGH |
| execa | ^9.6.1 | Run package manager install commands, detect Python tools | Best subprocess library for Node.js. Template literal syntax, better Windows support, proper error handling. For running `npm install`, `pip install`, `uv add`, etc. | HIGH |

### API Key Provisioning

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| @unkey/api | ^2.2.0 | Provision and manage TCC API keys | Project constraint -- Unkey is the key provider. Type-safe SDK, simple `keys.create()` API. Returns key on creation (one-time), key ID for management. | HIGH |

### Build & Development

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| tsup | ^8.5.0 | Bundle CLI to single distributable file | Already in use. Zero-config esbuild wrapper. Produces ESM output, handles TypeScript, tree-shakes dependencies. Perfect for CLI tools. | HIGH |
| typescript | ^5.9.3 | Type safety | Already in use. Latest stable. | HIGH |

### Framework & Package Manager Detection

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Node.js fs (built-in) | N/A | Detect frameworks and package managers by file presence | No library needed. Detection is file-existence checks: `pyproject.toml` (Poetry/uv), `requirements.txt` (pip), `uv.lock` (uv), `poetry.lock` (Poetry), `package.json` (Node), lockfiles for npm/yarn/pnpm/bun. The existing codebase already does this pattern well. | HIGH |

### MCP Config Writing

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Node.js fs (built-in) | N/A | Read/write MCP config JSON files | MCP configs are simple JSON files at known paths. No library needed beyond `JSON.parse`/`JSON.stringify` + `fs`. | HIGH |

**Known MCP config paths (2025/2026):**
- Cursor: `~/.cursor/mcp.json`
- Claude Code: CLI command (`claude mcp add`), not a file -- use `execa` to run it
- Windsurf: `~/.codeium/windsurf/mcp_config.json`
- VS Code (Copilot): `.vscode/mcp.json` (project-level)

**Config format:** All file-based editors use the same schema:
```json
{
  "mcpServers": {
    "context-company": {
      "command": "npx",
      "args": ["@contextcompany/mcp-client"],
      "env": { "TCC_API_KEY": "tcc_key_..." }
    }
  }
}
```

### Python Detection & Installation

No additional npm packages needed. Detection strategy:

| Signal File | Package Manager | Install Command |
|-------------|----------------|-----------------|
| `uv.lock` | uv | `uv add contextcompany[framework]` |
| `poetry.lock` | Poetry | `poetry add contextcompany[framework]` |
| `Pipfile` | pipenv | `pipenv install contextcompany[framework]` |
| `requirements.txt` only | pip | `pip install contextcompany[framework]` |
| `pyproject.toml` (no lock) | Check for `[tool.poetry]` or `[tool.uv]` sections, else default to pip | Varies |

Use `execa` to run the detected package manager's install command.

## What NOT to Use

| Library | Why Not |
|---------|---------|
| inquirer / enquirer | Heavier, less beautiful than @clack/prompts. Clack's connected-step UI is purpose-built for wizard flows. Already using clack. |
| chalk | Overkill. picocolors is 14x smaller, 2x faster, already in use. We don't need truecolor/RGB. |
| ora | Unnecessary. @clack/prompts includes `p.spinner()` with the same connected-step styling. Adding ora would break visual consistency. |
| Express / Fastify | No local HTTP server needed if using device code flow. If we fallback to localhost callback, `http.createServer()` is sufficient for a single-request server. |
| simple-oauth2 | Adds complexity for something that's 3 `fetch()` calls with WorkOS device flow. |
| node-keytar / cross-keychain | Native binary dependencies are a nightmare for `npx` execution. OS keychain is overkill for CLI tokens that are short-lived and refreshable. `conf` is sufficient. |
| commander / yargs | This is a wizard, not a multi-command CLI. Single entry point, interactive flow. `process.argv` parsing for `--key` flag is trivial. If we later need subcommands, add them then. |
| dotenv | We're writing .env files, not reading them. String manipulation with `fs` is simpler than pulling in a library. |

## Dependency Summary

### Runtime Dependencies (7 packages)

```bash
npm install @clack/prompts@^1.1.0 picocolors@^1.1.1 open@^10.1.0 execa@^9.6.1 @unkey/api@^2.2.0 conf@^15.1.0
```

Note: `open`, `execa`, and `conf` are all ESM-only. The project is already `"type": "module"` so this is fine.

### Dev Dependencies (unchanged)

```bash
npm install -D @types/node@^20 tsup@^8.5.0 typescript@^5.9.3
```

## Architecture Implications

1. **Zero native dependencies:** Everything listed above is pure JS/TS. This is critical for `npx` execution -- native binaries fail on version mismatches and require compilation.

2. **ESM-only:** All major dependencies are ESM-only. The project is already ESM. This is the right call for 2026.

3. **Minimal dependency footprint:** 7 runtime dependencies total. Each serves a clear, non-overlapping purpose. No dependency does something Node.js built-ins can handle.

4. **WorkOS device flow is the key architectural decision:** It eliminates the need for a local HTTP server, simplifies the auth flow, and is more reliable across environments. The entire auth flow is stateless HTTP polling.

## Sources

- [@clack/prompts npm](https://www.npmjs.com/package/@clack/prompts) -- v1.1.0, 5565 dependents
- [picocolors GitHub](https://github.com/alexeyraspopov/picocolors) -- 14x smaller than chalk
- [WorkOS CLI Auth docs](https://workos.com/docs/authkit/cli-auth) -- Device Authorization Flow
- [WorkOS blog: Node.js CLI auth](https://workos.com/blog/nodejs-cli-authentication-workos-oauth) -- Implementation guide
- [Vercel CLI changelog: Device Flow migration](https://vercel.com/changelog/new-vercel-cli-login-flow) -- Industry validation
- [open npm](https://www.npmjs.com/package/open) -- sindresorhus, cross-platform browser launch
- [execa npm](https://www.npmjs.com/package/execa) -- v9.6.1, process execution
- [@unkey/api npm](https://www.npmjs.com/package/@unkey/api) -- v2.2.0, API key management
- [conf npm](https://www.npmjs.com/package/conf) -- v15.1.0, CLI config storage
- [tsup npm](https://www.npmjs.com/package/tsup) -- esbuild-powered bundler
- [MCP config guide](https://help.yourgpt.ai/article/mcp-setup-guide-for-claude-desktop-cursor-and-windsurf-1789) -- Editor config paths

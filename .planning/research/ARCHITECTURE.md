# Architecture Patterns

**Domain:** CLI onboarding wizard spanning two repos (observatory + context)
**Researched:** 2026-03-30

## Recommended Architecture

The CLI (liftoff) is a **step pipeline** that orchestrates local detection, remote API calls, and filesystem mutations. The key insight: the CLI is a stateful orchestrator that accumulates a `WizardContext` object as it progresses through steps, where each step can read from and write to that context.

### High-Level Flow

```
User runs npx @contextcompany/liftoff
        |
        v
  [1. Detection Phase]  -- local only, no network
        |
        v
  [2. Auth Phase]        -- browser OAuth + localhost callback OR device flow
        |
        v
  [3. Provisioning Phase] -- API calls to context repo (dashboard)
        |
        v
  [4. Instrumentation Phase] -- local filesystem writes
        |
        v
  [5. Integration Phase]  -- MCP config + Slack setup (mixed local/remote)
        |
        v
  [6. Completion Phase]   -- deep-link to dashboard, summary
```

### Component Boundaries

| Component | Responsibility | Communicates With | Repo |
|-----------|---------------|-------------------|------|
| **CLI Entry** (`index.ts`) | Parse flags (`--key`, `--skip-auth`), launch pipeline | Pipeline runner | observatory |
| **Pipeline Runner** (`pipeline.ts`) | Execute steps in order, manage WizardContext, handle cancellation | All steps | observatory |
| **Detector** (`detect/`) | Framework, package manager, language, project structure detection | WizardContext (writes) | observatory |
| **Auth Client** (`auth/`) | Browser OAuth via WorkOS, localhost callback server, token storage | WorkOS (external), WizardContext | observatory |
| **API Client** (`api/`) | HTTP client for dashboard API -- key provisioning, org lookup | context public-api | observatory |
| **Instrumentor** (`instrument/`) | Install packages, write instrumentation files, fix gotchas, add metadata | Filesystem, package manager CLI | observatory |
| **MCP Configurator** (`integrations/mcp.ts`) | Detect editors, write MCP config files with readonly key | Filesystem (editor config dirs) | observatory |
| **Slack Connector** (`integrations/slack.ts`) | Walk through Slack workspace connection | context Slack OAuth endpoints | observatory |
| **Completion** (`completion.ts`) | Print summary, open dashboard deep-link | Browser (open URL) | observatory |
| **CLI Auth Endpoint** | Accept OAuth callback, issue session, provision keys via Unkey | WorkOS, Unkey | context |
| **Key Provisioning API** | Create org prod key + user readonly key, return to CLI | Unkey | context |

### The CLI-to-Server Boundary

The boundary between repos is a thin HTTP API surface. The CLI (observatory) makes exactly **three categories** of calls to the server (context):

1. **Auth initiation** -- Get the WorkOS authorization URL (or use device code flow)
2. **Token exchange** -- Exchange the OAuth code for a session + user info
3. **Key provisioning** -- Request API key creation for the authenticated user's org

Everything else is local. This is intentional -- minimize the API surface to reduce coupling between repos.

```
observatory (CLI)                    context (server)
================                    ================
                                    
auth/client.ts  ---- POST /api/cli/auth/start ----->  CLI auth endpoint
                                                       |
                <--- { authUrl, state } -----          | WorkOS
                                                       |
  [browser opens authUrl]                              |
  [user authenticates]                                 |
  [WorkOS redirects to localhost]                      |
                                                       |
auth/callback.ts  (captures code on localhost:PORT)    |
                                                       |
auth/client.ts  ---- POST /api/cli/auth/callback --->  Token exchange
                     { code, codeVerifier }             |
                                                       | WorkOS SDK
                <--- { user, orgId, session } ---      |
                                                       |
api/client.ts   ---- POST /api/cli/keys/provision -->  Key provisioning
                     { orgId, session }                 |
                                                       | Unkey SDK
                <--- { prodKey, readonlyKey } ---      |
```

## Data Flow: The WizardContext

The central data structure is `WizardContext`, which accumulates state as the pipeline progresses. This is the existing pattern from the current init CLI, extended to cover auth and integrations.

### Current WizardContext (what exists)

```typescript
interface WizardContext {
  framework: Framework;
  packageManager: PackageManager;
  mode: Mode;
  apiKey?: string;
  installDir: string;
  typescript: boolean;
  srcDir: boolean;
  appDir: boolean;
}
```

### Extended WizardContext (what liftoff needs)

```typescript
interface WizardContext {
  // Detection phase
  language: "typescript" | "python";
  framework: Framework;           // expanded to include python frameworks
  packageManager: PackageManager; // expanded: npm|yarn|pnpm|bun|pip|poetry|uv
  installDir: string;
  typescript: boolean;
  srcDir: boolean;
  appDir: boolean;

  // Auth phase
  user?: { id: string; email: string; name: string };
  orgId?: string;
  session?: string;               // short-lived session for API calls

  // Provisioning phase
  prodKey?: string;               // tcc_prod_xxx -- for instrumentation
  readonlyKey?: string;           // tcc_key_xxx -- for MCP

  // Flags (from CLI args or .env detection)
  skipAuth: boolean;              // --key flag provided or TCC_API_KEY in .env
  existingKey?: string;           // pre-existing key if found

  // Integration phase
  editors: EditorConfig[];        // detected editors for MCP setup
  slackConnected: boolean;
}
```

### Data Flow Direction

```
CLI flags (.env, --key)
    |
    v
[Detection] --> language, framework, packageManager, project structure
    |
    v
[Auth]      --> user, orgId, session  (skipped if skipAuth)
    |
    v
[Provision] --> prodKey, readonlyKey  (skipped if skipAuth)
    |
    v
[Instrument]--> writes files using framework + prodKey + language
    |
    v
[Integrate] --> writes MCP config using readonlyKey + editors
    |           calls Slack API using session
    v
[Complete]  --> reads entire context to print summary + deep-link
```

Each step reads what it needs from context and writes what it produces. Steps are **idempotent** where possible -- re-running should detect existing work and skip.

## Patterns to Follow

### Pattern 1: Step Pipeline with Bail-Out

Each step is an async function that receives and returns the mutable context. Steps can signal cancellation, skip (already done), or failure.

```typescript
type StepResult = "continue" | "skip" | "cancel";

interface Step {
  name: string;
  run(ctx: WizardContext): Promise<StepResult>;
  shouldRun?(ctx: WizardContext): boolean;  // pre-check
}

const pipeline: Step[] = [
  { name: "detect",     run: detect,     shouldRun: () => true },
  { name: "auth",       run: auth,       shouldRun: (ctx) => !ctx.skipAuth },
  { name: "provision",  run: provision,  shouldRun: (ctx) => !ctx.skipAuth },
  { name: "instrument", run: instrument, shouldRun: () => true },
  { name: "mcp",        run: setupMcp,   shouldRun: () => true },
  { name: "slack",      run: setupSlack, shouldRun: (ctx) => !!ctx.session },
  { name: "complete",   run: complete,   shouldRun: () => true },
];
```

**Why:** The current `run.ts` is a monolithic function with inline branching. A pipeline makes it testable (each step independently), extensible (add steps without touching others), and allows conditional skip logic (auth already done, key already exists).

### Pattern 2: Localhost OAuth Callback Server

Use a temporary HTTP server on localhost to capture the OAuth callback. Two viable approaches:

**Option A: Localhost callback (PKCE flow)** -- like `vercel login` pre-2025.
- CLI starts ephemeral HTTP server on a dynamic port
- Constructs WorkOS authorization URL with `redirect_uri=http://localhost:{port}/callback`
- Opens browser, user authenticates, WorkOS redirects back to localhost
- CLI captures the authorization code, exchanges it for tokens
- Server shuts down

**Option B: Device Authorization Grant** -- like Stripe CLI, Vercel CLI (2025+).
- CLI requests device code from server
- Displays verification code in terminal
- Polls server for completion
- No localhost server needed

**Recommendation: Option A (localhost callback with PKCE)** because:
1. PROJECT.md explicitly specifies "Browser-based OAuth via localhost callback (like `vercel login`) using WorkOS"
2. The `oauth-callback` npm package handles this cleanly (port selection, timeout, cleanup)
3. Faster UX -- user clicks one button in browser, no manual code entry
4. WorkOS supports PKCE natively via `getAuthorizationUrlWithPKCE()`

The server-side endpoint in the context repo needs to:
- Generate the WorkOS authorization URL with PKCE
- OR let the CLI generate it directly using WorkOS client ID (simpler -- no server round-trip for URL generation)

**Simplest approach:** CLI generates the auth URL locally using the WorkOS client ID (public, safe to embed), opens browser, captures code on localhost, sends code + code_verifier to context server for token exchange. This means only ONE server endpoint is needed: the token exchange.

```typescript
// CLI-side (observatory)
import { getAuthCode } from "oauth-callback";
import { WorkOS } from "@workos-inc/node";

const workos = new WorkOS(CLIENT_ID);  // public client ID, no secret
const { url, codeVerifier } = workos.userManagement.getAuthorizationUrlWithPKCE({
  redirectUri: `http://localhost:${port}/callback`,
  clientId: CLIENT_ID,
  provider: "authkit",
});

const { code } = await getAuthCode({ authorizationUrl: url, port });

// Exchange code on server (context)
const response = await fetch("https://api.thecontext.company/api/cli/auth/exchange", {
  method: "POST",
  body: JSON.stringify({ code, codeVerifier }),
});
```

### Pattern 3: Framework Setup as Strategy Pattern

Each framework (nextjs-aisdk, claude-agent-sdk, langchain-ts, langchain-py, crewai-py, etc.) implements a common interface. The current codebase already does this with per-framework setup files. Extend it.

```typescript
interface FrameworkSetup {
  id: Framework;
  detect(installDir: string): boolean;
  getPackages(ctx: WizardContext): string[];
  getInstrumentationFiles(ctx: WizardContext): FileWrite[];
  getGotchaFixes(ctx: WizardContext): GotchaFix[];
  getMetadataHooks(ctx: WizardContext): FileWrite[];
}
```

**Why:** Keeps framework-specific logic isolated. Adding a new framework means adding one file, not touching the pipeline.

### Pattern 4: Graceful Degradation

Every network-dependent step should have a skip path. If auth fails, offer `--key` fallback. If Slack OAuth fails, print manual instructions. If MCP editor detection finds nothing, skip silently.

```
Can't reach server?  --> "Enter your API key manually: ___"
Browser won't open?  --> "Visit this URL: ___"
Slack setup fails?   --> "Set up Slack later at app.thecontext.company/settings"
No editors found?    --> Skip MCP, mention it in summary
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Monolithic Run Function
**What:** Putting all logic in a single `run()` function (the current pattern).
**Why bad:** Untestable, hard to add conditional steps, cancellation logic becomes spaghetti.
**Instead:** Step pipeline with independent, testable step functions.

### Anti-Pattern 2: CLI Holding Secrets
**What:** Embedding the WorkOS API secret or Unkey admin key in the CLI package.
**Why bad:** Published to npm, anyone can extract them. The WorkOS client ID is public and safe. The API secret is not.
**Instead:** Token exchange happens on the context server. CLI only holds the public client ID. All secret-dependent operations go through the server API.

### Anti-Pattern 3: Tight Coupling to Server Endpoints
**What:** CLI directly calling internal dashboard endpoints or database.
**Why bad:** Any dashboard refactor breaks the CLI. Different release cadences.
**Instead:** Dedicated `/api/cli/*` namespace in context repo with versioned, stable contract. The CLI and dashboard are independent consumers of this API.

### Anti-Pattern 4: Blocking on Optional Steps
**What:** Requiring Slack setup or MCP setup to complete the wizard.
**Why bad:** Users who don't use Slack or supported editors get stuck.
**Instead:** Optional steps with clear skip UX. Core flow is: detect -> auth -> provision -> instrument -> done.

### Anti-Pattern 5: Storing Auth Tokens Long-Term
**What:** Persisting WorkOS session tokens to disk like Stripe CLI does.
**Why bad:** Liftoff is a one-shot wizard, not an ongoing CLI tool. The output is API keys in `.env`, not a stored session.
**Instead:** Session is ephemeral, lives only in WizardContext during the run. API keys are the durable artifact, written to `.env`.

## Component Build Order

Build order is dictated by dependency chains. Each layer depends on the one before it.

### Layer 0: Foundation (no dependencies)
- **Extended types** -- `WizardContext`, `Framework` (add Python frameworks), `Step` interface
- **Pipeline runner** -- generic step executor with skip/cancel logic
- **API client skeleton** -- typed fetch wrapper for `/api/cli/*` endpoints

### Layer 1: Detection (depends on Layer 0)
- **Language detection** -- is this a TS project or Python project? (package.json vs pyproject.toml/requirements.txt)
- **Framework detection** -- extend current detection to include Python frameworks
- **Package manager detection** -- extend to pip/poetry/uv

### Layer 2: Auth + Server Endpoints (depends on Layer 0)
- **Server: `/api/cli/auth/exchange`** -- in context repo, accepts code + codeVerifier, returns user + orgId + session
- **Server: `/api/cli/keys/provision`** -- in context repo, accepts orgId + session, creates keys via Unkey, returns them
- **CLI: Auth step** -- localhost callback server, browser open, PKCE flow
- **CLI: Provision step** -- call server to get keys

*Layer 1 and Layer 2 can be built in parallel -- they don't depend on each other.*

### Layer 3: Instrumentation (depends on Layer 1)
- **Python framework setups** -- new: langchain-py, crewai-py, agno-py, custom-py
- **Gotcha fixes** -- e.g., auto-add `experimental_telemetry` for AI SDK
- **Metadata hooks** -- auto-add `tcc.conversational`, `tcc.sessionId`, userId/orgId capture
- **Env file management** -- write keys from Layer 2 into `.env`

### Layer 4: Integrations (depends on Layer 2)
- **MCP configurator** -- detect Cursor/Claude Code/Windsurf/OpenCode, write config
- **Slack connector** -- walk user through Slack workspace OAuth
- **Server: Slack pro-gate removal** -- in context repo, allow free users

### Layer 5: Completion (depends on all above)
- **Summary printer** -- list everything that was done
- **Deep-link generator** -- URL to dashboard with pre-configured patterns
- **Error recovery** -- if any step failed, show manual instructions

### Build Order Diagram

```
Layer 0: Types + Pipeline + API Client
         |                |
    Layer 1: Detection    Layer 2: Auth + Server
         |                |
    Layer 3: Instrumentation
         |
    Layer 4: Integrations
         |
    Layer 5: Completion
```

### Cross-Repo Coordination

The context repo (server-side) work is isolated to Layer 2 and Layer 4:

| Phase | observatory (CLI) | context (server) |
|-------|-------------------|------------------|
| Layer 0 | Types, pipeline, API client | -- |
| Layer 1 | Detection (all local) | -- |
| Layer 2 | Auth client, provision client | Auth exchange endpoint, key provision endpoint |
| Layer 3 | Framework setups (all local) | -- |
| Layer 4 | MCP config (local), Slack client | Slack pro-gate removal |
| Layer 5 | Summary + deep-link (local) | -- |

The server work is small and well-scoped: **two new API endpoints** and **one permission change**. This should be defined contract-first (types/schema) so CLI and server can be built in parallel.

## API Contract (Server Endpoints Needed in Context Repo)

```typescript
// POST /api/cli/auth/exchange
interface AuthExchangeRequest {
  code: string;
  codeVerifier: string;
}
interface AuthExchangeResponse {
  user: { id: string; email: string; name: string };
  orgId: string;
  session: string;  // short-lived token for subsequent API calls
}

// POST /api/cli/keys/provision
interface KeyProvisionRequest {
  orgId: string;
}
// Headers: Authorization: Bearer {session}
interface KeyProvisionResponse {
  prodKey: string;     // tcc_prod_xxx
  readonlyKey: string; // tcc_key_xxx
}
```

## Scalability Considerations

| Concern | At launch | At 1K users/day | At 10K users/day |
|---------|-----------|-----------------|-------------------|
| Auth endpoint load | Negligible | Negligible (one-shot per user) | Still negligible -- no sustained traffic |
| Key provisioning | Direct Unkey API calls | Same | May want to batch or rate-limit |
| Localhost port conflicts | Dynamic port selection handles this | Same | Same |
| Package registry load | npm/pip install per user | Same (CDN-cached) | Same |
| CLI bundle size | Keep lean, no heavy deps | Same | Same |

The CLI is a one-shot tool, not a persistent service. Scalability concerns are minimal. The main concern is reliability of the auth flow (browser opening, port availability, WorkOS uptime).

## Sources

- [WorkOS CLI OAuth blog post](https://workos.com/blog/nodejs-cli-authentication-workos-oauth) -- Device flow pattern with WorkOS
- [WorkOS AuthKit PKCE docs](https://workos.com/docs/reference/authkit/authentication/get-authorization-url/pkce) -- PKCE authorization URL generation
- [oauth-callback library](https://github.com/kriasoft/oauth-callback) -- Lightweight localhost OAuth callback handler
- [How Stripe CLI login works](https://bentranter.ca/posts/stripes-cli-login/) -- Device verification pattern analysis
- [Vercel CLI login changelog](https://vercel.com/changelog/new-vercel-cli-login-flow) -- Migration to device flow
- [@clack/prompts](https://www.npmjs.com/package/@clack/prompts) -- CLI prompt library (already in use)

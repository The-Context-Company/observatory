<!-- GSD:project-start source:PROJECT.md -->
## Project

**@contextcompany/liftoff**

A zero-friction CLI onboarding wizard (`npx @contextcompany/liftoff`) that takes developers from zero to full AI agent observability in under 2 minutes. It auto-detects the user's framework, authenticates via browser OAuth, provisions API keys, instruments their codebase, sets up MCP for their coding tools, connects Slack alerts, and deep-links them to their first insight — so they see value before they even read the docs.

**Core Value:** Get developers to their first "oh shit, this found something useful" moment as fast as possible.

### Constraints

- **Auth provider**: WorkOS AuthKit — must use their OAuth flow
- **API key provider**: Unkey — must use their API for key provisioning
- **MCP protocol**: Standard MCP over HTTP with Bearer auth at api.thecontext.company/mcp
- **Slack**: Existing OAuth flow in context repo — remove Pro plan requirement, keep architecture
- **Package managers**: Must detect and use npm/yarn/pnpm/bun for TS, pip/poetry/uv for Python
- **Node version**: >=18.0.0
- **No breaking changes**: Existing SDK packages are stable, liftoff wraps them
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript 5.9.3 - Core SDK libraries and examples
- Python 3.9+ - AI agent observability SDK and instrumentation
- JavaScript (Next.js examples using React 19)
## Runtime
- Node.js 18.0.0+ (specified in all TS packages via `engines`)
- Python 3.9+ (via `requires-python` in pyproject.toml)
- pnpm 10.8.1 (root workspace)
- pip (Python dependency management)
- `pnpm-lock.yaml` - Present at root
- `poetry.lock` or requirements - Not detected (Python uses hatchling)
## Frameworks
- Next.js 16.0.7 - React framework for web examples
- React 19.2.0 - UI library for examples
- Preact 10.26.9 - Lightweight React alternative for widget component
- No test framework detected in codebase (no jest/vitest configs found)
- tsup 8.5.0+ - TypeScript bundler for all TS packages
- Postcss 8.5.6 - CSS processing for widget styling
- Tailwindcss 4 - Utility CSS framework
- hatchling - Python build backend
## Key Dependencies
- @opentelemetry/api 1.9.0 - OpenTelemetry API (peer dependency in @contextcompany/otel)
- @opentelemetry/sdk-trace-base 2.1.0+ - OTEL tracing SDK
- ws 8.18.3 - WebSocket client for real-time communication
- posthog-node 5.14.0 - Analytics/telemetry integration
- @anthropic-ai/claude-agent-sdk 0.1.0+ - Peer dependency for Claude integration package
- @langchain/core 0.2.0+ - Peer dependency for LangChain integration
- @mastra/core 0.24.0 - Peer dependency for Mastra integration
- ai 5.0.89+ - Vercel AI SDK
- @ai-sdk/openai 2.0.64+ - OpenAI integration for AI SDK
- @ai-sdk/react 2.0.89+ - React hooks for AI SDK
- @preact/signals 1.3.0 - State management for Preact
- lucide-preact 0.548.0 - Icon library
- markdown-to-jsx 8.0.0 - Markdown rendering
- react-json-view-lite 2.5.0 - JSON viewer component
- clsx 2.1.1 - CSS class name utility
- tailwind-merge 3.3.1 - Tailwind CSS merging utility
- requests 2.31.0+ - HTTP client library
- opentelemetry-sdk - OTEL SDK (optional dependency)
- opentelemetry-exporter-otlp-proto-http - OTLP HTTP exporter
- litellm - LLM abstraction library (optional)
- langchain - LangChain Python SDK (optional)
- openinference-instrumentation-agno - Agno instrumentation (optional)
- crewai - CrewAI framework (optional)
## Configuration
- `TCC_API_KEY` - Required for Context Company API authentication (dev_ prefix for dev environment)
- `TCC_BASE_URL` - Optional override for API base URL
- `TCC_FEEDBACK_URL` - Optional override for feedback endpoint
- `TCC_DEBUG` - Debug mode toggle (env or config)
- `NEXT_RUNTIME` - Next.js runtime detection for instrumentation setup
- `tsconfig.json` - Root and per-package TypeScript configuration
- `.prettierrc` - Prettier formatting config with import sorting
- `tsup.config.ts` - Bundler configuration in TS packages
- `next.config.ts` - Next.js configuration in examples
- `pyproject.toml` - Python package metadata and semantic versioning
## Platform Requirements
- Node.js 18+ with pnpm 10.8.1
- Python 3.9+ with hatchling
- TypeScript 5.9+
- Vercel (Next.js examples with @vercel/otel)
- Self-hosted capable via Node.js or Python runtimes
- Supports Anthropic Claude Agent SDK, LangChain, Mastra, CrewAI, and custom agents
## Workspace Structure
- `api` - Shared API utilities and feedback submission
- `otel` - OpenTelemetry integration with Next.js support
- `widget` - UI widget component (Preact-based)
- `claude` - Claude Agent SDK instrumentation
- `custom` - Generic TypeScript agent instrumentation
- `langchain` - LangChain.js and LangGraph integration
- `mastra` - Mastra framework integration
- `pi` - Additional integration (structure not detailed)
- `openclaw` - Additional integration (structure not detailed)
- `contextcompany` - Main observability SDK with framework-specific integrations
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- Classes: PascalCase, e.g., `TCCSpanProcessor.ts`, `RunBatchSpanProcessor.ts`
- Functions/utilities: camelCase, e.g., `useSyncTCCStore.ts`, `cn.ts`, `corners.ts`
- Components: PascalCase, e.g., `DataBlock.tsx`, `Copyable.tsx`
- Types/interfaces: camelCase with `.d.ts` extension for global types, e.g., `types.d.ts`, `global.d.ts`
- Utility functions: camelCase, e.g., `reconcileStore()`, `getEnrichedRun()`, `isStep()`
- Factory functions: lowercase, e.g., `run()` creates a `Run` instance
- Getter patterns: `get*()` prefix, e.g., `getTCCApiKey()`, `getTCCUrl()`, `getTCCBaseUrl()`
- Boolean predicates: `is*()` prefix, e.g., `isAttributeJson()`, `isStep()`, `isRetryable()`
- Hooks: `use*()` prefix, e.g., `useSyncTCCStore()`, `useSignal()`
- Private class methods: `_camelCase()` prefix, e.g., `_clearTimeout()`, `_send()`, `_buildPayload()`
- Signals (state): `*Signal` suffix, e.g., `widgetExpandedSignal`, `tccStoreSignal`, `selectedRunSignal`
- Event handlers: `handle*` prefix, e.g., `handleCopy()`, `handleDrag()`, `handlePointerMove()`
- Local state: camelCase, e.g., `isCopied`, `activeTab`, `containerRef`
- Constants: UPPER_SNAKE_CASE, e.g., `UNDOCKED_WIDTH`, `DEFAULT_TIMEOUT_MS`, `PREFERRED_PORTS`
- Type aliases: PascalCase, e.g., `FailedRun`, `UIRun`, `DockedMode`
- Payload types: `*Payload` suffix, e.g., `StepPayload`, `ToolCallPayload`
- Options/configuration types: `*Options` suffix, e.g., `RunOptions`, `TCCSpanProcessorOptions`
- Input types: `*Input` suffix, e.g., `RunInput`, `StepInput`, `ToolCallInput`
## Code Style
- Tool: Prettier v3.8.0
- Tab width: 2 spaces
- Line length: 80 characters
- Semicolons: enabled
- Quotes: double quotes (not single)
- Trailing commas: ES5 format
- No ESLint found — code style enforced via Prettier only
- Prettier plugins used: `@ianvs/prettier-plugin-sort-imports` and `prettier-plugin-tailwindcss`
## Import Organization
- `@/` maps to the package's `src/` directory (via TypeScript `moduleResolution: "Bundler"`)
- Used consistently across widget, otel, and other packages
## Error Handling
- Errors are typically console-logged with `[TCC]` prefix for identification
- Use `console.error()` for critical failures: `console.error("[TCC] Message")`
- Use `console.warn()` for non-critical issues: `console.warn("Widget already initialized")`
- Debug mode uses `debug()` function (controlled by env var or config)
## Logging
- All logs prefixed with `[TCC]` namespace for easy filtering
- Three levels: `debug()` (conditional on flag), `error()`, and `log()`
- Debug logger in `packages/ts/otel/src/internal/logger.ts` respects `setDebug()` flag
- Debug logger in `packages/ts/widget/src/internal/logger.ts` respects window.TCC_DEBUG flag
- Payloads are logged in pretty-printed JSON when debug enabled
- Network retries are logged with attempt count and backoff duration
## Comments
- JSDoc/TSDoc for public APIs and exported types
- Inline `// TODO:` for known limitations or future work (not blocking)
- No inline comments for obvious code — let clear naming speak for itself
- Comments on complex logic or non-obvious intent
- Extensive documentation on exported classes and functions
- `@param` tags for constructor parameters and method args
- `@example` blocks showing common usage patterns
- `@returns` tags describing return values
- `@internal` marker for internal implementation details not part of public API
- `@throws` when functions throw errors
## Function Design
- Use options objects for 2+ parameters, e.g., `constructor(options?: RunOptions)`
- Single required param is direct, optional params use object
- Type parameters explicitly declared
- Builder pattern: methods return `this` for chaining, e.g., `r.prompt().response().end()`
- Factory functions: return typed instances, e.g., `run()` returns `Run`
- Getters: return readonly values, e.g., `get runId(): string`
- Private helpers: return specific types, avoid `any`
## Module Design
- Default exports: used for single-export utility functions and components
- Named exports: used for classes, types, factory functions
- Index files act as barrel exports, grouping related exports: `export { Run, run } from "./run"`
- `index.ts` in each package aggregates and re-exports public API
- Example from `@contextcompany/custom`:
- Use leading underscore (`_property`, `_method`) for private class members
- Use `@internal` JSDoc tag for functions/types not intended for public use
- Internal payload types marked with `/** @internal */` comment
- Feedback functionality re-exported from `@contextcompany/api` in each package
- Configuration and URL resolution functions shared via `@contextcompany/api`
- Each instrumentation package (custom, otel, claude, etc.) self-contained
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- **Adapter pattern**: Each framework (Claude, LangChain, Mastra, OpenTelemetry) has a dedicated integration package that translates framework-specific events into a unified telemetry format
- **Hub-and-spoke data flow**: All adapters send data to centralized The Context Company API endpoints
- **Dual-mode operation**: Supports both cloud-based telemetry collection and local-first mode (for Vercel AI SDK on Next.js)
- **Lazy instrumentation**: Packages use Proxy objects and generators to transparently intercept and collect data without blocking core functionality
## Layers
- Purpose: Provide standardized configuration and API communication utilities across all packages
- Location: `packages/ts/api/src/`
- Contains: Configuration helpers (`getTCCApiKey()`, `getTCCUrl()`, `getTCCBaseUrl()`), feedback submission
- Depends on: Environment variables, fetch API
- Used by: All integration packages (claude, langchain, otel, mastra, custom, pi, openclaw)
- Purpose: Translate framework-specific events into TCC telemetry format
- Locations:
- Contains: Event collectors, payload formatters, transport handlers
- Depends on: API layer, framework SDKs, OpenTelemetry (where applicable)
- Used by: Client applications using specific frameworks
- Purpose: Standard-based span collection, batching, and export
- Location: `packages/ts/otel/src/`
- Contains:
- Depends on: OpenTelemetry APIs, API layer
- Used by: Applications using OpenTelemetry (Vercel AI SDK, Next.js instrumentation)
- Purpose: Enable local-first observability for development without cloud backend
- Location: `packages/ts/otel/src/nextjs/local/`
- Contains:
- Depends on: WebSocket, OpenTelemetry spans
- Used by: Local widget for real-time visualization
- Purpose: Browser-based visualization overlay for local mode and cloud telemetry
- Location: `packages/ts/widget/src/`
- Contains:
- Depends on: Preact, Signals, TailwindCSS
- Used by: Browser via script injection or Next.js
- Purpose: Unified observability for Python AI frameworks
- Location: `packages/python/contextcompany/`
- Contains: Integrations for LangChain, CrewAI, Agno, LiteLLM
- Depends on: Framework SDKs, requests
- Used by: Python applications
## Data Flow
## State Management
- Preact Signals hold reactive state: expanded/docked status, widget position, selected run
- `tccStoreSignal` - Key-value store of trace ID → run + tool calls
- `selectedRunSignal` - Currently selected run (computed from store)
- `failuresSignal` - Computed filter of runs/toolCalls with statusCode === 2
- No client-side state; data flows directly from instrumentation to API
- Widget (if present) may display feedback UI for submitting scores
## Key Abstractions
- Purpose: Implement OpenTelemetry SpanProcessor contract for TCC
- File: `packages/ts/otel/src/TCCSpanProcessor.ts`
- Pattern: Decorator over RunBatchSpanProcessor with AI span filtering
- Responsibility: Route spans to TCC or cloud
- Purpose: Batch spans by run ID and export as coherent units
- File: `packages/ts/otel/src/RunBatchSpanProcessor.ts`
- Pattern: State machine tracking span hierarchy (run → step → toolCall)
- Responsibility: Group spans, apply 10-minute flush timeout, export to exporter
- Purpose: Transparently collect SDK messages without blocking
- File: `packages/ts/claude/src/claude.ts` lines 75-142
- Pattern: Proxy over async generator
- Responsibility: Collect messages, track IDs, send telemetry after stream completes
- Purpose: Listen to LangChain events via callback interface
- File: `packages/ts/langchain/src/callback-handler.ts`
- Pattern: Observer listening to run_end, tool_start, tool_end events
- Responsibility: Extract data from LangChain objects, format, send
- Purpose: Consume Mastra's AITracingEvent stream
- File: `packages/ts/mastra/src/exporter.ts`
- Pattern: Listener for span started/ended/updated events
- Responsibility: Accumulate spans per trace, export when root ends
## Entry Points
- Location: `packages/ts/claude/src/claude.ts`
- Triggers: User imports and calls `instrumentClaudeAgent(sdk)`
- Responsibilities: Wrap query() and tool() methods, collect messages and metadata, send telemetry
- Location: `packages/ts/langchain/src/callback-handler.ts`
- Triggers: User instantiates TCCCallbackHandler and passes to chain.invoke()
- Responsibilities: Listen for LangChain events, track runs and tool calls, send telemetry
- Location: `packages/ts/otel/src/TCCSpanProcessor.ts`
- Triggers: User registers processor in OpenTelemetry tracer provider
- Responsibilities: Filter and process spans, batch, export
- Location: `packages/ts/otel/src/nextjs/instrumentation.ts`
- Triggers: `registerOTelTCC()` called in instrumentation.ts
- Responsibilities: Set up OpenTelemetry, register span processor, start WebSocket server, init anonymous telemetry
- Location: `packages/ts/widget/src/index.ts` (NPM) or `packages/ts/widget/src/auto.ts` (script injection)
- Triggers: `initWidget()` or auto.global.js script load
- Responsibilities: Create shadow DOM, inject styles, connect to WebSocket (local) or subscribe to store updates, render trace UI
- Location: `packages/ts/custom/src/index.ts`
- Triggers: User imports `run()`, `sendRun()`, builds data
- Responsibilities: Provide builder pattern interface, format payloads, send to `/v1/custom`
## Error Handling
- Missing API key: Log error, return early (Claude, OTel, custom)
- Network errors in feedback submission: Log error, return undefined
- Span export errors: Log error, continue collecting (no retry)
- Malformed data: Log error, filter out (e.g., LangChain callback ignoring unknown event types)
- Stream errors during telemetry send: Catch and log, do not block stream completion
## Cross-Cutting Concerns
- Each package uses `console.log/error` with `[TCC]` prefix
- Debug flag optional on most integrations (Claude, OTel, etc.)
- `packages/ts/otel/src/internal/logger.ts` exports debug/setDebug for OTel
- Feedback text max 2000 chars (API layer)
- Span status codes checked against known values (RunBatchSpanProcessor)
- API key format checked for dev_ prefix to determine endpoint
- All requests use Bearer token: `Authorization: Bearer ${apiKey}`
- API key from `TCC_API_KEY` environment variable or function parameter
- No special session/user tracking beyond runId and sessionId
- Base URL auto-detected from API key prefix: `dev_*` → dev endpoint, else prod
- Can be overridden by `TCC_BASE_URL` environment variable
- Specific endpoints: `/v1/feedback`, `/v1/traces`, `/v1/claude`, `/v1/langchain`, `/v1/mastra`, `/v1/custom`, `/v1/pi`
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->

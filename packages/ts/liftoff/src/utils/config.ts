/**
 * Central resolver for the TCC endpoint base URL. Every step imports
 * `getApiBase()` / `getMcpServerUrl()` instead of hardcoding — so one
 * `--api-base` flag (parsed in index.ts) swings every outbound call
 * the wizard makes.
 *
 * Resolution order:
 *   1. The URL set via `setApiBase()` (from the `--api-base` flag)
 *   2. `TCC_BASE_URL` env var — matches the convention used by the SDK
 *      packages (see packages/ts/api/src/config.ts). Undocumented in
 *      `--help`, meant for shell aliases / CI / internal dev workflows.
 *   3. Prod default: https://api.thecontext.company
 */

const DEFAULT_API_BASE = "https://api.thecontext.company";
const DEFAULT_DASHBOARD_URL = "https://www.thecontext.company";

let overrideApiBase: string | undefined;

/** Called once at startup from index.ts after parsing `--api-base`. */
export function setApiBase(url: string | undefined): void {
  overrideApiBase = url?.replace(/\/+$/, "") || undefined;
}

/**
 * Resolved TCC API base URL (no trailing slash). All `/cli/*` routes
 * and the `/mcp` endpoint hang off this.
 */
export function getApiBase(): string {
  if (overrideApiBase) return overrideApiBase;
  const fromEnv = process.env.TCC_BASE_URL?.replace(/\/+$/, "");
  if (fromEnv) return fromEnv;
  return DEFAULT_API_BASE;
}

/**
 * MCP server URL written into editor config files (Cursor, Claude
 * Code, Windsurf, …). Whatever the user's `--api-base` was at wizard
 * time is what their editor will permanently point at.
 */
export function getMcpServerUrl(): string {
  return `${getApiBase()}/mcp`;
}

/**
 * Dashboard URL used only for the deeplink in the success summary.
 * The dashboard is a separate subdomain, so it isn't derived from
 * `--api-base`. Hardcoded for now; add a flag later if self-hosted
 * customers need to override it.
 */
export function getDashboardUrl(): string {
  return DEFAULT_DASHBOARD_URL;
}

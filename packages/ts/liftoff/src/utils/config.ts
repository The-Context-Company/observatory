// Central resolver for the TCC endpoint base URL. Resolution order:
// (1) the URL set via setApiBase() from --api-base, (2) TCC_BASE_URL
// env var (matches the SDK packages, undocumented; for CI / dev),
// (3) prod default.

const DEFAULT_API_BASE = "https://api.thecontext.company";
const DEV_API_BASE = "https://dev.thecontext.company";
const DEFAULT_DASHBOARD_URL = "https://www.thecontext.company";
const ALLOWED_REMOTE_BASES = new Set([DEFAULT_API_BASE, DEV_API_BASE]);

let overrideApiBase: string | undefined;

function unsafeApiBaseAllowed(): boolean {
  return process.env.TCC_ALLOW_UNSAFE_BASE_URL === "1";
}

function normalizeApiBase(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`[TCC] Invalid --api-base URL: ${url}`);
  }

  const base = parsed.origin + parsed.pathname.replace(/\/+$/, "");
  const isLocalhost =
    /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(parsed.origin);

  if (
    ALLOWED_REMOTE_BASES.has(parsed.origin) ||
    isLocalhost ||
    unsafeApiBaseAllowed()
  ) {
    return base;
  }

  throw new Error(
    `[TCC] Refusing unsafe --api-base (${base}). Use ${DEFAULT_API_BASE}, ${DEV_API_BASE}, localhost, or set TCC_ALLOW_UNSAFE_BASE_URL=1 for self-hosted testing.`
  );
}

export function setApiBase(url: string | undefined): void {
  overrideApiBase = url ? normalizeApiBase(url) : undefined;
}

export function getApiBase(): string {
  if (overrideApiBase) return overrideApiBase;
  const fromEnv = process.env.TCC_BASE_URL
    ? normalizeApiBase(process.env.TCC_BASE_URL)
    : undefined;
  if (fromEnv) return fromEnv;
  return DEFAULT_API_BASE;
}

export function getMcpServerUrl(): string {
  return `${getApiBase()}/mcp`;
}

// The dashboard is a separate subdomain, so it isn't derived from
// --api-base. Hardcoded until self-hosted customers need an override.
export function getDashboardUrl(): string {
  return DEFAULT_DASHBOARD_URL;
}

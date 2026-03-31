const PROD_BASE = "https://api.thecontext.company";
const DEV_BASE = "https://dev.thecontext.company";

/**
 * Get TCC API key from environment
 */
export function getTCCApiKey(): string | undefined {
  if (typeof process !== "undefined" && process.env) {
    return process.env.TCC_API_KEY;
  }
  return undefined;
}

/**
 * Get the TCC base URL (no trailing slash).
 * Reads from `TCC_BASE_URL` env var, otherwise auto-detects from API key prefix.
 */
export function getTCCBaseUrl(apiKey?: string): string {
  if (typeof process !== "undefined" && process.env?.TCC_BASE_URL) {
    return process.env.TCC_BASE_URL.replace(/\/+$/, "");
  }
  const envApiKey =
    typeof process !== "undefined" && process.env
      ? process.env.TCC_API_KEY
      : undefined;
  const key = apiKey ?? envApiKey ?? "";
  return key.startsWith("dev_") ? DEV_BASE : PROD_BASE;
}

/**
 * Get a full TCC endpoint URL by appending a path to the base URL.
 * @param path - The path to append (e.g. "/v1/pi")
 * @param apiKey - API key to check for dev_ prefix
 */
export function getTCCUrl(path: string, apiKey?: string): string {
  return `${getTCCBaseUrl(apiKey)}${path}`;
}

/**
 * Get TCC Feedback URL with default (same across all packages)
 */
export function getTCCFeedbackUrl(): string {
  const envUrl =
    typeof process !== "undefined" && process.env
      ? process.env.TCC_FEEDBACK_URL
      : undefined;
  return envUrl ?? `${getTCCBaseUrl()}/v1/feedback`;
}

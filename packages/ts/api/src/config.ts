/**
 * Get TCC API key from environment
 */
export function getTCCApiKey(): string | undefined {
  return process.env.TCC_API_KEY;
}

/**
 * Get TCC URL from environment with automatic dev/prod selection
 * @param apiKey - API key to check for dev_ prefix
 * @param prodUrl - Production URL default
 * @param devUrl - Development URL default
 */
export function getTCCUrl(apiKey: string | undefined, prodUrl: string, devUrl: string): string {
  if (process.env.TCC_URL) {
    return process.env.TCC_URL;
  }

  return apiKey?.startsWith("dev_") ? devUrl : prodUrl;
}

/**
 * Get TCC Feedback URL with default (same across all packages)
 */
export function getTCCFeedbackUrl(): string {
  return process.env.TCC_FEEDBACK_URL ?? "https://api.thecontext.company/v1/feedback";
}

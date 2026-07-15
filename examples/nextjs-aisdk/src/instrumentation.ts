// Initialize The Context Company (TCC) OpenTelemetry integration
// This automatically instruments all AI SDK calls for observability
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerTCC } = await import("@contextcompany/ai-sdk/nextjs");
    registerTCC({ debug: process.env.TCC_DEBUG === "1" });
  }
}

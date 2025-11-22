export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerOTelTCC } = await import("@contextcompany/otel/nextjs");
    registerOTelTCC({ debug: true });
  }
}

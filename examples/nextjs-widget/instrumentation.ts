import { registerOTelTCC } from "@contextcompany/otel/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    registerOTelTCC({ local: true });
  }
}

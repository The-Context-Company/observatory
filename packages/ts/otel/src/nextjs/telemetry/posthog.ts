import { PostHog } from "posthog-node";
import { randomUUID } from "crypto";
import { TCCAnonymousTelemetryEvent } from "./events";
import { debug } from "../../internal/logger";

const PUBLIC_TCC_POSTHOG_API_KEY =
  "phc_TYxBWOf98HlV783y088fPVnw5sVEusZaihbvvgISCFR";

let posthog: PostHog | null = null;
let distinctId: string | null = null;

export const initAnonymousTelemetry = () => {
  if (process.env.TCC_DISABLE_ANONYMOUS_TELEMETRY === "true" || distinctId)
    return;

  distinctId = randomUUID();

  posthog = new PostHog(PUBLIC_TCC_POSTHOG_API_KEY, {
    host: "https://us.i.posthog.com",
    flushAt: 5,
    flushInterval: 5000,
  });
};

export const captureAnonymousEvent = (
  eventData: TCCAnonymousTelemetryEvent
) => {
  try {
    if (process.env.TCC_DISABLE_ANONYMOUS_TELEMETRY === "true" || !distinctId)
      return;

    const { event, ...properties } = eventData;

    debug(`Event received: ${event}`);

    posthog?.capture({
      distinctId,
      event,
      properties,
    });
  } catch {}
};

export const shutdownPosthog = async () => {
  await posthog?.shutdown();
  posthog = null;
  distinctId = null;
};

import { registerOTel } from "@vercel/otel";
import { startWebSocketServer } from "./ws";
import { tccLocalSpanProcessor } from "./runtime";
import {
  captureAnonymousEvent,
  initAnonymousTelemetry,
} from "../telemetry/posthog";

const auto = () => {
  initAnonymousTelemetry();
  captureAnonymousEvent({
    event: "local_mode_start",
  });

  startWebSocketServer();
  registerOTel({
    spanProcessors: [tccLocalSpanProcessor()],
  });
};

auto();

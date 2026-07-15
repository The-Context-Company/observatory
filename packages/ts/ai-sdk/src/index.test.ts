import { afterEach, describe, expect, it, vi } from "vitest";
import { registerTCC } from "./index";

const mocks = vi.hoisted(() => ({
  forceFlush: vi.fn(async () => undefined),
  sdkShutdown: vi.fn(async () => undefined),
  sdkStart: vi.fn(),
}));

vi.mock("@contextcompany/otel", () => ({
  submitFeedback: vi.fn(),
  TCCSpanProcessor: class {
    forceFlush = mocks.forceFlush;
  },
}));

vi.mock("@opentelemetry/sdk-node", () => ({
  NodeSDK: class {
    start = mocks.sdkStart;
    shutdown = mocks.sdkShutdown;
  },
}));

const nodeRegistrationKey = Symbol.for("@contextcompany/ai-sdk.node");
const telemetryRegistrationKey = Symbol.for("@contextcompany/ai-sdk.telemetry");

afterEach(() => {
  delete (globalThis as any)[nodeRegistrationKey];
  delete (globalThis as any)[telemetryRegistrationKey];
  (globalThis as any).AI_SDK_TELEMETRY_INTEGRATIONS = [];
  vi.clearAllMocks();
});

describe("registerTCC", () => {
  it("keeps registration and shutdown idempotent for the process lifetime", async () => {
    const registration = registerTCC();

    expect(registerTCC()).toBe(registration);
    expect(mocks.sdkStart).toHaveBeenCalledTimes(1);

    await registration.shutdown();
    await registration.shutdown();

    expect(mocks.sdkShutdown).toHaveBeenCalledTimes(1);
    expect(registerTCC()).toBe(registration);
    expect(mocks.sdkStart).toHaveBeenCalledTimes(1);
  });
});

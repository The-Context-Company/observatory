import { describe, expect, it } from "vitest";
import { tccTelemetry } from "./telemetry";

describe("tccTelemetry", () => {
  it("creates AI SDK 7 runtime context from canonical metadata", () => {
    const result = tccTelemetry({
      metadata: {
        "tcc.runId": "00000000-0000-4000-8000-000000000001",
        "tcc.sessionId": "session-1",
        "tcc.userId": "user-1",
        "tcc.userName": "Jane Doe",
        "tcc.orgId": "org-1",
        "tcc.orgName": "Acme Inc.",
        "tcc.agent": "support-agent",
        "tcc.conversational": true,
        environment: "test",
      },
    });

    expect(result.runtimeContext).toEqual({
      environment: "test",
      "tcc.runId": "00000000-0000-4000-8000-000000000001",
      "tcc.sessionId": "session-1",
      "tcc.conversational": true,
      "tcc.agent": "support-agent",
      "tcc.userId": "user-1",
      "tcc.userName": "Jane Doe",
      "tcc.orgId": "org-1",
      "tcc.orgName": "Acme Inc.",
    });
    expect(result.telemetry.includeRuntimeContext).toEqual({
      environment: true,
      "tcc.runId": true,
      "tcc.sessionId": true,
      "tcc.conversational": true,
      "tcc.agent": true,
      "tcc.userId": true,
      "tcc.userName": true,
      "tcc.orgId": true,
      "tcc.orgName": true,
    });
  });

  it("keeps legacy top-level fields working", () => {
    expect(
      tccTelemetry({
        runId: "00000000-0000-4000-8000-000000000001",
        sessionId: "legacy-session",
      }).runtimeContext
    ).toMatchObject({
      "tcc.runId": "00000000-0000-4000-8000-000000000001",
      "tcc.sessionId": "legacy-session",
    });
  });

  it("prefers canonical metadata over legacy top-level fields", () => {
    expect(
      tccTelemetry({
        runId: "00000000-0000-4000-8000-000000000001",
        sessionId: "legacy-session",
        metadata: {
          "tcc.runId": "00000000-0000-4000-8000-000000000002",
          "tcc.sessionId": "canonical-session",
        },
      }).runtimeContext
    ).toMatchObject({
      "tcc.runId": "00000000-0000-4000-8000-000000000002",
      "tcc.sessionId": "canonical-session",
    });
  });

  it("rejects invalid run IDs and unsupported TCC metadata", () => {
    expect(() => tccTelemetry({ runId: "not-a-uuid" })).toThrow("valid UUID");
    expect(() =>
      tccTelemetry({
        metadata: {
          "tcc.runId": "00000000-0000-4000-8000-000000000001",
          "tcc.unknown": "value",
        },
      })
    ).toThrow("unsupported");
  });
});

import { describe, expect, it } from "vitest";
import { tccTelemetry } from "./telemetry";

describe("tccTelemetry", () => {
  it("creates AI SDK 7 runtime context and includes every field", () => {
    const result = tccTelemetry({
      runId: "00000000-0000-4000-8000-000000000001",
      sessionId: "session-1",
      userId: "user-1",
      conversational: true,
      metadata: { environment: "test" },
    });

    expect(result.runtimeContext).toEqual({
      environment: "test",
      "tcc.runId": "00000000-0000-4000-8000-000000000001",
      "tcc.sessionId": "session-1",
      "tcc.conversational": true,
      "tcc.userId": "user-1",
    });
    expect(result.telemetry.includeRuntimeContext).toEqual({
      environment: true,
      "tcc.runId": true,
      "tcc.sessionId": true,
      "tcc.conversational": true,
      "tcc.userId": true,
    });
  });

  it("rejects invalid run IDs and reserved metadata", () => {
    expect(() => tccTelemetry({ runId: "not-a-uuid" })).toThrow("valid UUID");
    expect(() =>
      tccTelemetry({
        runId: "00000000-0000-4000-8000-000000000001",
        metadata: { "tcc.userId": "override" },
      })
    ).toThrow("reserved");
  });
});

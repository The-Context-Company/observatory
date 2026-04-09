import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatDate,
  getAgoString,
  getMsToFinish,
  nanosToSeconds,
  recursivelyInjectDateFields,
} from "../time";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("time.ts", () => {
  describe("getAgoString", () => {
    it("returns 'just now' for a sub second diff", () => {
      const date = new Date("2026-01-01T00:00:00.000Z");
      expect(getAgoString(date)).toBe("just now");
    });

    it("returns seconds ago", () => {
      const date = new Date("2025-12-31T23:59:55.000Z"); // 5 seconds ago
      expect(getAgoString(date)).toBe("5s ago");
    });

    it("returns minutes ago", () => {
      const date = new Date("2025-12-31T23:58:00.000Z"); // 2 minutes ago
      expect(getAgoString(date)).toBe("2m ago");
    });

    it("returns hours ago", () => {
      const date = new Date("2025-12-31T22:00:00.000Z"); // 2 hours ago
      expect(getAgoString(date)).toBe("2h ago");
    });

    it("returns days ago", () => {
      const date = new Date("2025-12-31T00:00:00.000Z"); // 1 day ago
      expect(getAgoString(date)).toBe("1d ago");
    });

    it("returns weeks ago", () => {
      const date = new Date("2025-12-21T00:00:00.000Z"); // 10 days ago - 1 week
      expect(getAgoString(date)).toBe("1w ago");
    });

    it("returns months ago", () => {
      const date = new Date("2025-10-31T00:00:00.000Z"); // 2 months ago
      expect(getAgoString(date)).toBe("2mo ago");
    });

    it("returns years ago", () => {
      const date = new Date("2025-01-01T00:00:00.000Z"); // 1 year ago
      expect(getAgoString(date)).toBe("1y ago");
    });

    it("returns years ago for extreme past dates", () => {
      const date = new Date("1900-01-01T00:00:00.000Z"); // 126 years ago
      expect(getAgoString(date)).toBe("126y ago");
    });
  });

  describe("nanosToSeconds", () => {
    it("returns 1 for exactly 1 billion nanoseconds", () => {
      expect(nanosToSeconds(1000000000)).toBe(1); // 1 second
    });

    it("returns 0 for exactly 0 nanoseconds", () => {
      expect(nanosToSeconds(0)).toBe(0);
    });

    it("converts nanoseconds to seconds with 3 decimal places by default", () => {
      // Note this should round up to 1.235 instead of 1.234
      expect(nanosToSeconds(1234567890)).toBe(1.235); // 1.234567890 seconds
    });

    it("respects a custom toFixed value", () => {
      expect(nanosToSeconds(1234567890, 1)).toBe(1.2);
    });
  });

  // formatDate output is timezone-dependent by design
  // toLocaleString converts to local machine time zone for instance
  // 2026-01-01T00:00:00.000Z is December 31, 2025 at 07:00 PM for New York
  describe("formatDate", () => {
    it("formats properly for American dating system", () => {
      const date = new Date(2026, 0, 1, 12, 0, 0, 0);
      expect(formatDate(date)).toContain("January 1, 2026");
    });

    it("returns a non-empty string", () => {
      expect(typeof formatDate(new Date())).toBe("string");
    });
  });

  // Note: the catch block in getMsToFinish is unreachable
  // accessing a missing object key in JS returns undefined
  describe("getMsToFinish", () => {
    it("returns the value when attribute exists", () => {
      const attributes: Record<string, unknown> = { "ai.response.msToFinish": 1500 };
      expect(getMsToFinish(attributes)).toBe(1500);
    });

    it("returns undefined when attribute is missing", () => {
      const attributes: Record<string, unknown> = {};
      expect(getMsToFinish(attributes)).toBeUndefined();
    });

    it("returns undefined for unrelated attributes", () => {
      const attributes: Record<string, unknown> = { "ai.response.someOtherThing": 1500 };
      expect(getMsToFinish(attributes)).toBeUndefined();
    });
  });

  // Note: the catch block is unreachable — new Date() never throws in JavaScript
  describe("recursivelyInjectDateFields", () => {
    describe("happy path", () => {
      it("converts a valid ISO date string to a Date object", () => {
        const result = recursivelyInjectDateFields({
          startTime: "2026-01-01T00:00:00.000Z",
        });
        expect(result).toEqual({
          startTime: new Date("2026-01-01T00:00:00.000Z"),
        });
      });

      it("converts multiple date fields in the same object", () => {
        const result = recursivelyInjectDateFields({
          startTime: "2026-01-01T00:00:00.000Z",
          endTime: "2026-01-01T01:00:00.000Z",
        });
        expect(result).toEqual({
          startTime: new Date("2026-01-01T00:00:00.000Z"),
          endTime: new Date("2026-01-01T01:00:00.000Z"),
        });
      });

      it("converts date strings in nested objects", () => {
        const result = recursivelyInjectDateFields({
          run: { startTime: "2026-01-01T00:00:00.000Z" },
        });
        expect(result).toEqual({
          run: { startTime: new Date("2026-01-01T00:00:00.000Z") },
        });
      });

      it("converts date strings inside arrays", () => {
        const result = recursivelyInjectDateFields([
          { startTime: "2026-01-01T00:00:00.000Z" },
          { startTime: "2026-01-01T01:00:00.000Z" },
        ]);
        expect(result).toEqual([
          { startTime: new Date("2026-01-01T00:00:00.000Z") },
          { startTime: new Date("2026-01-01T01:00:00.000Z") },
        ]);
      });

      it("handles a realistic run payload shape", () => {
        const result = recursivelyInjectDateFields({
          traceId: "abc123",
          startTime: "2026-01-01T00:00:00.000Z",
          durationNs: 5000000000,
          steps: [{ spanId: "step1", startTime: "2026-01-01T00:00:01.000Z" }],
        }) as any;
        expect(result.startTime).toBeInstanceOf(Date);
        expect(result.steps[0].startTime).toBeInstanceOf(Date);
        expect(result.traceId).toBe("abc123");
        expect(result.durationNs).toBe(5000000000);
      });
    });

    describe("sad path", () => {
      it("passes through numbers unchanged", () => {
        expect(recursivelyInjectDateFields({ duration: 1000 })).toEqual({
          duration: 1000,
        });
      });

      it("passes through booleans unchanged", () => {
        expect(recursivelyInjectDateFields({ active: true })).toEqual({
          active: true,
        });
      });

      it("passes through null unchanged", () => {
        expect(recursivelyInjectDateFields(null)).toBeNull();
      });

      it("passes through non-date strings unchanged", () => {
        expect(recursivelyInjectDateFields({ name: "my agent" })).toEqual({
          name: "my agent",
        });
      });

      it("does not convert partial ISO strings that fail the regex", () => {
        // missing milliseconds — intentionally does not match the strict regex
        const result = recursivelyInjectDateFields({
          startTime: "2026-01-01T00:00:00Z",
        });
        expect(result).toEqual({ startTime: "2026-01-01T00:00:00Z" });
      });
    });
  });
});

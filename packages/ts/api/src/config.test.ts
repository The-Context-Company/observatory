import { afterEach, describe, expect, it } from "vitest";
import { normalizeTCCBaseUrl } from "./config";

const OLD_ENV = process.env.TCC_ALLOW_UNSAFE_BASE_URL;

afterEach(() => {
  if (OLD_ENV === undefined) delete process.env.TCC_ALLOW_UNSAFE_BASE_URL;
  else process.env.TCC_ALLOW_UNSAFE_BASE_URL = OLD_ENV;
});

describe("normalizeTCCBaseUrl", () => {
  it("allows official TCC origins", () => {
    expect(normalizeTCCBaseUrl("https://api.thecontext.company/")).toBe(
      "https://api.thecontext.company"
    );
    expect(normalizeTCCBaseUrl("https://api.thecontext.company/v1")).toBe(
      "https://api.thecontext.company/v1"
    );
    expect(normalizeTCCBaseUrl("https://dev.thecontext.company")).toBe(
      "https://dev.thecontext.company"
    );
  });

  it("allows localhost for development", () => {
    expect(normalizeTCCBaseUrl("http://localhost:8787/")).toBe(
      "http://localhost:8787"
    );
  });

  it("rejects arbitrary remote origins unless explicitly allowed", () => {
    expect(() => normalizeTCCBaseUrl("https://evil.example")).toThrow(
      /Refusing unsafe/
    );

    process.env.TCC_ALLOW_UNSAFE_BASE_URL = "1";
    expect(normalizeTCCBaseUrl("https://self-hosted.example/")).toBe(
      "https://self-hosted.example"
    );
  });
});

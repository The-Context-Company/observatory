import { afterEach, describe, expect, it } from "vitest";
import { assertSafeTCCUrl, normalizeTCCBaseUrl } from "./config";

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

describe("assertSafeTCCUrl", () => {
  it("allows official TCC and localhost endpoints", () => {
    expect(() =>
      assertSafeTCCUrl("https://api.thecontext.company/v1/traces")
    ).not.toThrow();
    expect(() =>
      assertSafeTCCUrl("https://dev.thecontext.company/v1/custom")
    ).not.toThrow();
    expect(() =>
      assertSafeTCCUrl("http://localhost:8787/v1/feedback")
    ).not.toThrow();
  });

  it("refuses to send credentials to arbitrary origins", () => {
    expect(() => assertSafeTCCUrl("https://evil.example/v1/traces")).toThrow(
      /Refusing to send credentials/
    );
    // A look-alike host that merely embeds the allowed domain must be rejected.
    expect(() =>
      assertSafeTCCUrl("https://api.thecontext.company.evil.example/v1/traces")
    ).toThrow(/Refusing to send credentials/);
  });

  it("throws on malformed URLs", () => {
    expect(() => assertSafeTCCUrl("not a url")).toThrow(/Invalid TCC URL/);
  });

  it("allows arbitrary origins only with the unsafe opt-in", () => {
    expect(() =>
      assertSafeTCCUrl("https://self-hosted.example/v1/traces")
    ).toThrow(/Refusing to send credentials/);

    process.env.TCC_ALLOW_UNSAFE_BASE_URL = "1";
    expect(() =>
      assertSafeTCCUrl("https://self-hosted.example/v1/traces")
    ).not.toThrow();
  });
});

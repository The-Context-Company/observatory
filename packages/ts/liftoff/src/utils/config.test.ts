import { afterEach, describe, expect, it } from "vitest";
import { getApiBase, setApiBase } from "./config";

const OLD_ENV = {
  TCC_BASE_URL: process.env.TCC_BASE_URL,
  TCC_ALLOW_UNSAFE_BASE_URL: process.env.TCC_ALLOW_UNSAFE_BASE_URL,
};

afterEach(() => {
  setApiBase(undefined);
  if (OLD_ENV.TCC_BASE_URL === undefined) delete process.env.TCC_BASE_URL;
  else process.env.TCC_BASE_URL = OLD_ENV.TCC_BASE_URL;
  if (OLD_ENV.TCC_ALLOW_UNSAFE_BASE_URL === undefined) {
    delete process.env.TCC_ALLOW_UNSAFE_BASE_URL;
  } else {
    process.env.TCC_ALLOW_UNSAFE_BASE_URL = OLD_ENV.TCC_ALLOW_UNSAFE_BASE_URL;
  }
});

describe("liftoff API base config", () => {
  it("accepts official and localhost bases", () => {
    setApiBase("https://api.thecontext.company/");
    expect(getApiBase()).toBe("https://api.thecontext.company");

    setApiBase("https://api.thecontext.company/v1");
    expect(getApiBase()).toBe("https://api.thecontext.company/v1");

    setApiBase("http://localhost:8787/");
    expect(getApiBase()).toBe("http://localhost:8787");
  });

  it("rejects arbitrary --api-base values by default", () => {
    expect(() => setApiBase("https://evil.example")).toThrow(/Refusing unsafe/);
  });

  it("allows explicit unsafe override for self-hosted testing", () => {
    process.env.TCC_ALLOW_UNSAFE_BASE_URL = "1";
    setApiBase("https://self-hosted.example/");
    expect(getApiBase()).toBe("https://self-hosted.example");
  });
});

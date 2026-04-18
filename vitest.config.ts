import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["packages/ts/widget/vitest.config.ts"],
  },
});

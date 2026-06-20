import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      "packages/ts/api/vitest.config.ts",
      "packages/ts/liftoff/vitest.config.ts",
      "packages/ts/widget/vitest.config.ts",
    ],
  },
});

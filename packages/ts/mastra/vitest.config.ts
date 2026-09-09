import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // The package's `exports` point at dist/, which is not built in CI's test job.
      "@contextcompany/api": fileURLToPath(
        new URL("../api/src/index.ts", import.meta.url)
      ),
    },
  },
  test: {
    include: ["src/**/*.{test,spec}.?(c|m)[jt]s?(x)"],
  },
});

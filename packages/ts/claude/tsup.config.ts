import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm", "cjs"],
  dts: { entry: { index: "src/index.ts" } },
  splitting: false,
  treeshake: true,
  clean: true,
  external: ["@anthropic-ai/claude-agent-sdk", "@contextcompany/api"],
});

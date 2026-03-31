import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm", "cjs"],
  dts: { entry: { index: "src/index.ts" } },
  splitting: false,
  treeshake: true,
  clean: true,
  external: ["@mariozechner/pi-coding-agent", "@mariozechner/pi-agent-core", "@mariozechner/pi-ai"],
});

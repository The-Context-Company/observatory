import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm"],
  banner: { js: "#!/usr/bin/env node" },
  splitting: false,
  treeshake: true,
  clean: true,
  target: "node18",
});

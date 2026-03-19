import { defineConfig } from "tsup";

export default defineConfig([
  // Library entry point
  {
    entry: { index: "src/index.ts" },
    format: ["esm", "cjs"],
    dts: { entry: { index: "src/index.ts" } },
    splitting: false,
    treeshake: true,
    clean: true,
    external: ["@contextcompany/api"],
  },
  // CLI entry point
  {
    entry: { cli: "src/cli.ts" },
    format: ["esm"],
    banner: { js: "#!/usr/bin/env node" },
    splitting: false,
    treeshake: true,
    clean: false,
    external: ["@contextcompany/api"],
  },
]);

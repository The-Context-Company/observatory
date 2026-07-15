import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    splitting: false,
    treeshake: true,
    clean: true,
  },
  {
    entry: { "nextjs/index": "src/nextjs.ts" },
    format: ["esm", "cjs"],
    dts: true,
    splitting: false,
    treeshake: true,
    clean: false,
  },
]);

import { defineConfig } from "tsup";

export default defineConfig([
  // @contextcompany/otel
  {
    entry: { index: "src/index.ts" },
    format: ["esm", "cjs"],
    dts: { entry: { index: "src/index.ts" } },
    splitting: false,
    treeshake: true,
    clean: true,
    external: ["@opentelemetry/api", "@vercel/otel"],
  },
  // @contextcompany/otel/nextjs
  {
    entry: { "nextjs/index": "src/nextjs/index.ts" },
    format: ["esm", "cjs"],
    dts: { entry: { "nextjs/index": "src/nextjs/index.ts" } },
    splitting: false,
    treeshake: true,
    clean: true,
    external: ["@opentelemetry/api", "@vercel/otel"],
  },
]);

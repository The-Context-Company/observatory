import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/auto.ts"],
    outDir: "dist",
    format: ["iife"],
    platform: "browser",
    target: "es2020",
    globalName: "TCC_Widget",
    minify: true,
    sourcemap: false,
    treeshake: true,
    dts: true,
    clean: true,
    loader: {
      ".css": "text",
    },
    outExtension: () => ({
      js: ".global.js",
    }),
    external: ["react", "react-dom"],
  },
  {
    entry: ["src/index.ts"],
    outDir: "dist",
    format: ["esm", "cjs"],
    platform: "browser",
    target: "es2020",
    dts: true,
    sourcemap: false,
    clean: false,
    loader: {
      ".css": "text",
      ".png": "dataurl",
    },
    external: ["preact", "@preact/signals"],
  },
]);

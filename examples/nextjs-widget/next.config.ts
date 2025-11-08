import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    urlImports: [
      "http://localhost:3002/nextjs/local/auto.global.js",
      "https://unpkg.com/@contextcompany/otel@1.0.9/dist/nextjs/local/auto.global.js",
    ],
  },
};

export default nextConfig;

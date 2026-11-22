import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  // Development only: lets a phone on the same Wi-Fi or hotspot use the dev site.
  // Without this, Next.js 16 blocks the scripts on other devices and buttons don't work.
  allowedDevOrigins: ["192.168.*.*", "172.16.*.*", "172.20.*.*", "10.*.*.*", "*.local"],

  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

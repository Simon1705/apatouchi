import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the dev server to serve HMR/asset requests over the local network so
  // the mobile-first app can be tested from a phone on the same WiFi.
  // Dev-only; adjust the IP to match this machine's LAN address.
  allowedDevOrigins: ["192.168.1.106"],
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

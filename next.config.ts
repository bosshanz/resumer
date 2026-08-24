import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: [
    "better-sqlite3",
    "puppeteer-core",
    "https-proxy-agent",
    "agent-base",
    "openid-client",
    "@earendil-works/pi-agent-core",
    "@earendil-works/pi-ai",
  ],
};

export default nextConfig;

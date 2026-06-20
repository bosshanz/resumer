import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: [
    "better-sqlite3",
    "puppeteer-core",
    "https-proxy-agent",
    "agent-base",
    "openid-client",
  ],
};

export default nextConfig;

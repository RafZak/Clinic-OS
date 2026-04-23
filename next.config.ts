import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "googleapis",
    "google-auth-library",
    "pdf-parse",
    "mammoth",
    "@deepgram/sdk",
  ],
};

export default nextConfig;

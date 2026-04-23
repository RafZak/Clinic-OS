import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "voyageai",
    "googleapis",
    "google-auth-library",
    "pdf-parse",
    "mammoth",
    "@deepgram/sdk",
  ],
};

export default nextConfig;

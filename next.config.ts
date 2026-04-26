import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "googleapis",
    "google-auth-library",
    "pdf-parse",
    "mammoth",
    "@deepgram/sdk",
  ],
};

export default withNextIntl(nextConfig);

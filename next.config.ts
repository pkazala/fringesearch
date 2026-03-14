import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.api.edinburghfestivalcity.com",
      },
    ],
  },
  env: {
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:
      process.env.GOOGLE_MAPS_API_KEY ??
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ??
      "",
  },
};

export default nextConfig;

if (process.env.NODE_ENV === "development" && process.env.VERCEL !== "1") {
  void import("@opennextjs/cloudflare").then((module) => module.initOpenNextCloudflareForDev());
}

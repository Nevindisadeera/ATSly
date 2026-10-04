import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  // Files named *.dev.tsx are routes only under `next dev` (e.g. the /design reference page).
  // Production builds never see them.
  pageExtensions: isDev ? ["dev.tsx", "tsx", "ts"] : ["tsx", "ts"],
};

export default nextConfig;

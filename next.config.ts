import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

import { contentSecurityPolicy, SECURITY_HEADERS } from "./src/lib/security/headers";

export default function nextConfig(phase: string): NextConfig {
  // Files named *.dev.tsx are routes only under `next dev` (e.g. the /design reference page).
  // Production builds never see them. Keyed on the phase rather than NODE_ENV, which is
  // not yet set when a fresh dev server loads this file.
  const isDevServer = phase === PHASE_DEVELOPMENT_SERVER;
  const https =
    process.env.VERCEL === "1" ||
    (process.env.NEXT_PUBLIC_APP_URL ?? "").startsWith("https://");

  return {
    pageExtensions: isDevServer ? ["dev.tsx", "tsx", "ts"] : ["tsx", "ts"],
    poweredByHeader: false,
    // Security headers and the base CSP — src/lib/security/headers.ts. Left out of the
    // dev server, where hot reloading needs eval and websockets.
    async headers() {
      if (isDevServer) return [];
      return [
        {
          source: "/:path*",
          headers: [
            ...SECURITY_HEADERS,
            { key: "Content-Security-Policy", value: contentSecurityPolicy({ https }) },
          ],
        },
      ];
    },
  };
}

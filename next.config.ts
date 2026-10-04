import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

export default function nextConfig(phase: string): NextConfig {
  // Files named *.dev.tsx are routes only under `next dev` (e.g. the /design reference page).
  // Production builds never see them. Keyed on the phase rather than NODE_ENV, which is
  // not yet set when a fresh dev server loads this file.
  const isDevServer = phase === PHASE_DEVELOPMENT_SERVER;

  return {
    pageExtensions: isDevServer ? ["dev.tsx", "tsx", "ts"] : ["tsx", "ts"],
  };
}

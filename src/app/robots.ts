import type { MetadataRoute } from "next";

import { site } from "@/lib/config/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Personal reports and account pages are never indexed.
      disallow: ["/api/", "/results/", "/dashboard", "/settings", "/scan"],
    },
    sitemap: `${site.url}/sitemap.xml`,
  };
}

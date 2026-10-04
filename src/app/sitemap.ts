import type { MetadataRoute } from "next";

import { site } from "@/lib/config/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = [
    { path: "", priority: 1, changeFrequency: "monthly" },
    { path: "/methodology", priority: 0.8, changeFrequency: "monthly" },
    { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
    { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
  ] as const;

  return pages.map((p) => ({
    url: `${site.url}${p.path}`,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));
}

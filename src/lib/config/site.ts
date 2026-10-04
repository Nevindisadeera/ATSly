/** Public site metadata. Safe to import from client and server code. */
export const site = {
  name: "ATSly",
  tagline: "ATS resume analysis",
  description:
    "Analyze your resume, uncover missing keywords, and understand how well it matches your target role.",
  url: (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  repositoryUrl: "https://github.com/Nevindisadeera/ATSly",
} as const;

import type { ResumeSectionKind } from "@/types/api";

/** Display names for parsed resume section kinds. */
export const SECTION_LABELS: Record<ResumeSectionKind, string> = {
  contact: "Contact",
  summary: "Summary",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
  projects: "Projects",
  certifications: "Certifications",
  languages: "Languages",
  awards: "Awards",
  publications: "Publications",
  volunteering: "Volunteering",
  interests: "Interests",
  other: "Other",
};

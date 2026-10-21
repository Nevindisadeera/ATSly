import { Briefcase, Lightbulb } from "lucide-react";

import { EmptyState, SectionHeading } from "@/components/data-display";

/**
 * Job match and recommendations render their empty states until job matching (Phase 9b) and
 * AI analysis (Phase 10b) fill them — docs/PLANNING.md §28, Stage 8.
 */
export function JobMatchSection() {
  return (
    <section id="job-match" aria-labelledby="job-match-title" className="scroll-mt-20">
      <SectionHeading id="job-match-title" as="h2" size="h3" title="Job match" />
      <EmptyState
        className="mt-6"
        icon={<Briefcase />}
        title="No job description added"
        description="Matching against a specific job posting is coming soon. This report covers ATS compatibility, which applies to any role."
      />
    </section>
  );
}

export function RecommendationsSection() {
  return (
    <section
      id="recommendations"
      aria-labelledby="recommendations-title"
      className="scroll-mt-20"
    >
      <SectionHeading
        id="recommendations-title"
        as="h2"
        size="h3"
        title="Recommendations"
      />
      <EmptyState
        className="mt-6"
        icon={<Lightbulb />}
        title="Personalized suggestions are coming soon"
        description="Until then, the issues above list exactly what to fix, in order of impact."
      />
    </section>
  );
}

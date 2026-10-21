import { Lightbulb } from "lucide-react";

import { EmptyState, SectionHeading } from "@/components/data-display";

/**
 * Recommendations render their empty state until AI analysis (Phase 10b) fills them —
 * docs/PLANNING.md §28, Stage 8.
 */
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

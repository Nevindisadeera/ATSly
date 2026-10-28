import { SectionHeading } from "@/components/data-display";
import { Container } from "@/components/layout/container";
import { RecommendationCard } from "@/components/report/recommendation-card";
import type { RecommendationView } from "@/lib/report/types";

/**
 * A sample of what the results page recommends. Like real suggestions, the rewrite keeps
 * the bullet's own facts and leaves a placeholder for the result instead of inventing one.
 */
const EXAMPLE: RecommendationView = {
  id: "example",
  anchor: "example-recommendation",
  priority: "high",
  categoryLabel: "Content quality",
  title: "Lead with what you did and what changed",
  detail:
    "This bullet describes a duty, not an achievement. Starting with an action and ending with the result shows recruiters the impact of your work.",
  before: "Responsible for the React dashboard the sales team used for weekly reporting.",
  after:
    "Owned the React dashboard the sales team uses for weekly reporting, cutting report preparation time by [X %].",
  placeholders: ["[X %]"],
  location: "Experience › Acme Corp › bullet 1",
  source: "ai",
  sourceLabel: "AI suggestion",
  checkAnchor: null,
  related: null,
};

export function ExampleRecommendation() {
  return (
    <section
      aria-labelledby="example-title"
      className="border-t border-border bg-soft py-20 md:py-28"
    >
      <Container width="reading">
        <SectionHeading
          id="example-title"
          align="center"
          eyebrow="Recommendations"
          title="Advice you can act on."
          description="Instead of “improve your experience section”, you get the exact bullet, why it is weak, and a stronger version that keeps your facts."
        />

        <RecommendationCard rec={EXAMPLE} className="mt-14 shadow-card" />
      </Container>
    </section>
  );
}

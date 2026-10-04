import { SectionHeading } from "@/components/data-display";
import { Container } from "@/components/layout/container";

/**
 * Static example of a recommendation. The interactive RecommendationCard (with copy
 * action) is built with the results page in Phase 10b.
 */
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

        <article className="mt-14 rounded-lg border border-border bg-background p-6 shadow-card sm:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex h-6 items-center rounded-full border border-border-strong px-2.5 text-xs font-medium text-foreground">
              High priority
            </span>
            <span className="text-xs text-subtle">Experience › Acme Corp › bullet 1</span>
          </div>
          <h3 className="mt-5 type-h4">Show what you built and the result</h3>
          <p className="mt-2 leading-7 text-subtle">
            This bullet names an activity but not the product, the technologies, or the
            outcome. Recruiters and ATS keyword searches both reward specifics.
          </p>

          <dl className="mt-6 grid gap-4">
            <div className="rounded-md border border-border bg-soft p-4">
              <dt className="type-caption text-subtle">Current</dt>
              <dd className="mt-2 text-body">Worked on frontend development.</dd>
            </div>
            <div className="rounded-md border border-border-strong p-4">
              <dt className="type-caption text-subtle">Suggested</dt>
              <dd className="mt-2 text-foreground">
                Built a customer reporting dashboard in React and TypeScript, reducing
                report preparation time by [X%].
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-sm text-subtle">
            Replace [X%] with your real result. Suggestions never invent numbers.
          </p>
        </article>
      </Container>
    </section>
  );
}

import { SectionHeading } from "@/components/data-display";
import { Container } from "@/components/layout/container";

const BENEFITS = [
  {
    title: "Explainable scoring",
    body: "Six categories, published weights, and a line-by-line breakdown of every deduction.",
  },
  {
    title: "Specific recommendations",
    body: "Advice quotes your own bullets and points to where they are, not generic tips.",
  },
  {
    title: "Honest about limits",
    body: "Scores are estimates based on common ATS practices. We never claim to know a vendor's algorithm.",
  },
  {
    title: "Your data, your control",
    body: "Your original file is not stored. Delete your scans and account at any time.",
  },
];

export function Benefits() {
  return (
    <section
      aria-labelledby="benefits-title"
      className="border-t border-border py-20 md:py-28"
    >
      <Container>
        <SectionHeading
          id="benefits-title"
          eyebrow="Why ATSly"
          title="Built to be trusted."
        />
        <ul className="mt-14 grid gap-x-10 gap-y-12 sm:grid-cols-2 xl:grid-cols-4">
          {BENEFITS.map((b) => (
            <li key={b.title} className="border-t border-foreground pt-6">
              <h3 className="type-h4">{b.title}</h3>
              <p className="mt-3 leading-7 text-subtle">{b.body}</p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

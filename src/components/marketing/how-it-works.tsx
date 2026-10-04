import { SectionHeading } from "@/components/data-display";
import { Container } from "@/components/layout/container";

const STEPS = [
  {
    title: "Upload",
    body: "Add your resume as a PDF or DOCX. Optionally paste the job description you're applying for.",
  },
  {
    title: "Analyze",
    body: "ATSly checks structure, formatting, keywords and content, then compares your experience with the role.",
  },
  {
    title: "Improve",
    body: "Get a prioritized list of specific changes, with suggested wording based on your own bullets.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-title"
      className="scroll-mt-20 py-20 md:py-28"
    >
      <Container>
        <SectionHeading
          id="how-it-works-title"
          eyebrow="How it works"
          title="Three steps. About a minute."
        />
        <ol className="mt-14 grid md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li
              key={step.title}
              className="border-t border-border py-8 md:border-t-0 md:border-l md:px-8 md:py-2 md:first:border-l-0 md:first:pl-0"
            >
              <p className="text-sm font-medium text-muted-foreground tabular-nums">
                0{i + 1}
              </p>
              <h3 className="mt-4 type-h4">{step.title}</h3>
              <p className="mt-3 leading-7 text-subtle">{step.body}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

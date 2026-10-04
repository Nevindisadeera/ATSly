import { Container } from "@/components/layout/container";

export function ValueStatement() {
  return (
    <section
      aria-label="Why ATSly"
      className="border-y border-border bg-soft py-20 md:py-28"
    >
      <Container width="reading">
        <p className="text-center text-[1.625rem] leading-[2.125rem] font-normal tracking-[-0.02em] text-balance text-foreground md:text-[2.125rem] md:leading-[2.75rem]">
          Most resumes are filtered by software before a person reads them. ATSly shows
          you what that software sees, and exactly what to change.
        </p>
      </Container>
    </section>
  );
}

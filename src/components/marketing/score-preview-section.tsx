import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { ScoreBar, SectionHeading } from "@/components/data-display";
import { Container } from "@/components/layout/container";

import { SAMPLE_REPORT } from "./sample-report";

export function ScorePreviewSection() {
  const { categories, ats } = SAMPLE_REPORT;
  return (
    <section
      aria-labelledby="score-title"
      className="border-t border-border py-20 md:py-28"
    >
      <Container className="grid items-center gap-14 lg:grid-cols-2 lg:gap-24">
        <div>
          <SectionHeading
            id="score-title"
            eyebrow="ATS compatibility"
            title="Every point explained."
            description="Your score combines six categories with published weights. Each deduction names the check, the evidence we found, and how to fix it."
          />
          <Link
            href="/methodology"
            className="mt-8 inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Read the methodology
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
        <div className="rounded-lg border border-border bg-background p-6 shadow-card sm:p-8">
          <div className="grid gap-5">
            {categories.map((c) => (
              <ScoreBar
                animate={false}
                key={c.label}
                label={c.label}
                value={c.score}
                weight={c.weight}
              />
            ))}
          </div>
          <div className="mt-8 flex items-baseline justify-between border-t border-border pt-5">
            <p className="text-sm text-subtle">Weighted overall score</p>
            <p className="text-sm font-medium text-foreground tabular-nums">
              {ats.score} / 100
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}

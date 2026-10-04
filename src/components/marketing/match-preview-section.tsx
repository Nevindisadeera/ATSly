import {
  EvidenceBlock,
  KeywordChip,
  ScoreRing,
  SectionHeading,
} from "@/components/data-display";
import { Container } from "@/components/layout/container";

import { SAMPLE_REPORT } from "./sample-report";

export function MatchPreviewSection() {
  const { match, matched, missing, evidence } = SAMPLE_REPORT;
  return (
    <section
      aria-labelledby="match-title"
      className="border-t border-border py-20 md:py-28"
    >
      <Container className="grid items-center gap-14 lg:grid-cols-2 lg:gap-24">
        <div className="lg:order-2">
          <SectionHeading
            id="match-title"
            eyebrow="Job matching"
            title="See which requirements you cover, and which you don’t."
            description="Paste a job description. ATSly compares it with your resume requirement by requirement and quotes the evidence it found."
          />
          <p className="mt-6 text-sm leading-6 text-subtle">
            We never suggest adding skills you don’t have. Missing keywords come with a
            simple rule: if you have the experience, make it explicit.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-background p-6 shadow-card sm:p-8 lg:order-1">
          <div className="flex items-center gap-5">
            <ScoreRing
              animate={false}
              value={match.score}
              band={match.band}
              label="Sample job match"
              size={96}
            />
            <div>
              <p className="font-medium text-foreground">Frontend Engineer</p>
              <p className="text-sm text-subtle">Moderate match · 4 of 7 requirements</p>
            </div>
          </div>

          <div className="mt-8 grid gap-6">
            <div>
              <h3 className="text-sm font-medium text-foreground">Matched</h3>
              <ul className="mt-3 flex flex-wrap gap-2">
                {matched.map((term) => (
                  <li key={term}>
                    <KeywordChip term={term} state="matched" importance="required" />
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-medium text-foreground">Missing</h3>
              <ul className="mt-3 flex flex-wrap gap-2">
                {missing.map((m) => (
                  <li key={m.term}>
                    <KeywordChip
                      term={m.term}
                      state="missing"
                      importance={m.importance}
                    />
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-medium text-foreground">
                Evidence for “{evidence.requirement}”
              </h3>
              <EvidenceBlock
                className="mt-3"
                text={evidence.text}
                location={evidence.location}
              />
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

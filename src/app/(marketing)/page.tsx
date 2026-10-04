import { Benefits } from "@/components/marketing/benefits";
import { CtaBand } from "@/components/marketing/cta-band";
import { ExampleRecommendation } from "@/components/marketing/example-recommendation";
import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { MatchPreviewSection } from "@/components/marketing/match-preview-section";
import { ScorePreviewSection } from "@/components/marketing/score-preview-section";
import { ValueStatement } from "@/components/marketing/value-statement";

export default function LandingPage() {
  return (
    <>
      <Hero />
      <ValueStatement />
      <HowItWorks />
      <ScorePreviewSection />
      <MatchPreviewSection />
      <Benefits />
      <ExampleRecommendation />
      <CtaBand />
    </>
  );
}

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";

import { ReportPreview } from "./report-preview";

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="pt-12 pb-20 md:pt-20 md:pb-28">
      <Container className="grid items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)] lg:gap-16">
        <div className="max-w-[560px]">
          <p className="type-caption text-muted-foreground">ATS resume analysis</p>
          <h1 id="hero-title" className="mt-5 type-display text-balance">
            Make your resume ATS&#8209;ready.
          </h1>
          <p className="mt-6 type-lead text-pretty text-subtle">
            Analyze your resume, uncover missing keywords, and understand how well it
            matches your target role.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/scan">Scan my resume</Link>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <Link href="#how-it-works">
                See how it works
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
          <p className="mt-6 text-sm text-subtle">
            PDF or DOCX · Free · No account required to start
          </p>
        </div>
        <ReportPreview />
      </Container>
    </section>
  );
}

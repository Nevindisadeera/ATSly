import Link from "next/link";

import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";

export function CtaBand() {
  return (
    <section aria-labelledby="cta-title" className="bg-navy py-20 md:py-24">
      <Container className="flex flex-col items-start gap-8 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 id="cta-title" className="type-h2 text-balance text-white">
            Ready to see how your resume reads?
          </h2>
          <p className="mt-3 text-slate-300">Free. No account required to start.</p>
        </div>
        <Button
          asChild
          size="lg"
          className="bg-white text-navy hover:bg-slate-100 focus-visible:ring-white focus-visible:ring-offset-navy"
        >
          <Link href="/scan">Scan my resume</Link>
        </Button>
      </Container>
    </section>
  );
}

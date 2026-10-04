import type { Metadata } from "next";

import { Container } from "@/components/layout/container";
import { ScanStepper } from "@/components/scan/scan-stepper";
import { UploadStep } from "@/components/scan/upload-step";

export const metadata: Metadata = {
  title: "Scan your resume",
};

export default function ScanPage() {
  return (
    <Container width="reading" className="py-12 md:py-20">
      <ScanStepper current={0} />
      <h1 className="mt-10 type-h1">Scan your resume</h1>
      <p className="mt-4 type-lead text-pretty text-subtle">
        Upload your resume to see how applicant tracking systems may read it. You can add
        a job description in the next step.
      </p>
      <section aria-label="Upload your resume" className="mt-10">
        <UploadStep />
      </section>
      <p className="mt-6 text-sm text-subtle">
        Your original file is read once and not stored.
      </p>
    </Container>
  );
}

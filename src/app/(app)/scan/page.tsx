import type { Metadata } from "next";

import { Container } from "@/components/layout/container";
import { ScanFlow } from "@/components/scan/scan-flow";

export const metadata: Metadata = {
  title: "Scan your resume",
};

export default function ScanPage() {
  return (
    <Container width="reading" className="py-12 md:py-20">
      <ScanFlow />
    </Container>
  );
}

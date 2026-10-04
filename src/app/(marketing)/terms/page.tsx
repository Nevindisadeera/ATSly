import type { Metadata } from "next";
import Link from "next/link";

import { ProsePage } from "@/components/layout/prose";
import { site } from "@/lib/config/site";

export const metadata: Metadata = {
  title: "Terms",
  description: "The terms for using ATSly.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <ProsePage
      eyebrow="Legal"
      title="Terms of use"
      lead="Plain-language terms for using ATSly."
      updated="4 October 2026"
    >
      <h2 id="the-service">The service</h2>
      <p>
        ATSly analyzes resumes and job descriptions and provides an estimated ATS
        compatibility score, a job match score, and recommendations. It is provided free
        of charge, as is, and may change over time.
      </p>

      <h2 id="estimates">Scores are estimates</h2>
      <p>
        Scores and recommendations are guidance based on common ATS practices, not a
        guarantee of how any employer or system will treat your application. See{" "}
        <Link href="/methodology">how scoring works</Link> for details. You are
        responsible for the accuracy of anything you include in your resume, including
        suggested wording you choose to use.
      </p>

      <h2 id="your-content">Your content</h2>
      <p>
        You keep ownership of everything you upload. You give ATSly permission to process
        it only to provide the service to you, as described in the{" "}
        <Link href="/privacy">privacy policy</Link>. Only upload documents you have the
        right to share.
      </p>

      <h2 id="acceptable-use">Acceptable use</h2>
      <ul>
        <li>Don&apos;t upload other people&apos;s resumes without their permission.</li>
        <li>
          Don&apos;t attempt to disrupt the service, bypass limits, or access other
          users&apos; data.
        </li>
        <li>Don&apos;t use automated means to submit large numbers of scans.</li>
      </ul>
      <p>We may limit or suspend access that breaks these rules.</p>

      <h2 id="liability">Liability</h2>
      <p>
        To the extent permitted by law, ATSly is not liable for decisions made based on
        its scores or recommendations, or for loss arising from use of the service.
      </p>

      <h2 id="changes">Changes</h2>
      <p>
        We may update these terms. The date at the top of this page shows when they last
        changed.
      </p>

      <h2 id="contact">Contact</h2>
      <p>
        Questions can be raised through the{" "}
        <a href={site.repositoryUrl} rel="noreferrer">
          ATSly GitHub repository
        </a>
        .
      </p>
    </ProsePage>
  );
}

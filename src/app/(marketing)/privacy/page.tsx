import type { Metadata } from "next";

import { ProsePage } from "@/components/layout/prose";
import { site } from "@/lib/config/site";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What ATSly stores, why, for how long, and how to delete it.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <ProsePage
      eyebrow="Legal"
      title="Privacy"
      lead="Your resume contains personal information. This page explains what ATSly keeps, what it doesn't, and how to remove it."
      updated="4 October 2026"
    >
      <h2 id="what-we-store">What we store</h2>
      <ul>
        <li>
          <strong>The text extracted from your resume</strong> and the structured version
          we build from it (sections, roles, skills).
        </li>
        <li>
          <strong>Job descriptions</strong> you paste in.
        </li>
        <li>
          <strong>Your reports:</strong> scores, findings and recommendations.
        </li>
        <li>
          <strong>Account details</strong> if you create an account: name, email address,
          and a securely hashed password, or your Google account identifier.
        </li>
      </ul>

      <h2 id="what-we-dont-store">What we don&apos;t store</h2>
      <ul>
        <li>
          Your original PDF or DOCX file. It is read once to extract text and then
          discarded.
        </li>
        <li>Resume or job description text in our application logs.</li>
      </ul>

      <h2 id="retention">How long we keep it</h2>
      <ul>
        <li>
          <strong>Without an account:</strong> scans are deleted automatically after 7
          days.
        </li>
        <li>
          <strong>With an account:</strong> scans are kept until you delete them or your
          account.
        </li>
      </ul>

      <h2 id="processors">Who processes it</h2>
      <p>We use a small number of service providers to run ATSly:</p>
      <ul>
        <li>
          <strong>OpenAI</strong> analyzes resume content and job descriptions to produce
          recommendations. Your name, email address and phone number are removed before
          resume content is sent.
        </li>
        <li>
          <strong>MongoDB Atlas</strong> hosts our database.
        </li>
        <li>
          <strong>Vercel</strong> hosts the application.
        </li>
      </ul>
      <p>We do not sell your data or use it for advertising.</p>

      <h2 id="cookies">Cookies</h2>
      <p>
        We use only the cookies needed for ATSly to work: one that keeps you signed in,
        and one that links scans to your browser when you use ATSly without an account.
      </p>

      <h2 id="your-choices">Your choices</h2>
      <p>
        You can delete any scan from your report or dashboard, and delete your account and
        all associated data from your account settings. Deletion is permanent.
      </p>

      <h2 id="contact">Contact</h2>
      <p>
        Questions about privacy can be raised through the{" "}
        <a href={site.repositoryUrl} rel="noreferrer">
          ATSly GitHub repository
        </a>
        .
      </p>
    </ProsePage>
  );
}

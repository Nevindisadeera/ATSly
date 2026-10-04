import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { site } from "@/lib/config/site";

import { Container } from "./container";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/#how-it-works", label: "How it works" },
      { href: "/methodology", label: "Methodology" },
      { href: "/scan", label: "Scan a resume" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
      { href: site.repositoryUrl, label: "GitHub", external: true },
    ],
  },
];

const linkClass =
  "rounded-sm text-sm text-subtle transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-soft">
      <Container className="grid gap-12 py-14 md:grid-cols-[1fr_auto] md:gap-24">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-4 text-sm leading-6 text-subtle">
            Understand how applicant tracking systems may read your resume, and exactly
            what to change.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-12 sm:gap-20">
          {COLUMNS.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h2 className="text-sm font-medium text-foreground">{column.title}</h2>
              <ul className="mt-4 grid gap-3">
                {column.links.map((link) => (
                  <li key={link.href}>
                    {"external" in link ? (
                      <a href={link.href} className={linkClass} rel="noreferrer">
                        {link.label}
                      </a>
                    ) : (
                      <Link href={link.href} className={linkClass}>
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </Container>
      <Container>
        <div className="flex flex-col gap-2 border-t border-border py-6 text-sm text-subtle sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} ATSly</p>
          <p>Scores are estimates based on common ATS practices.</p>
        </div>
      </Container>
    </footer>
  );
}

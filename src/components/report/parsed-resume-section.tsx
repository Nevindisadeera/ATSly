import { Info } from "lucide-react";

import { SectionHeading } from "@/components/data-display";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { ParsedEntryView, ParsedResumeView } from "@/lib/report/types";

function Flags({ flags }: { flags: string[] }) {
  if (flags.length === 0) return null;
  return (
    <ul className="mt-2 grid gap-1">
      {flags.map((flag) => (
        <li key={flag} className="flex gap-2 text-xs leading-5 text-warning-strong">
          <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          {flag}
        </li>
      ))}
    </ul>
  );
}

function Entry({ entry }: { entry: ParsedEntryView }) {
  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="font-medium text-foreground">{entry.heading}</div>
      {entry.subheading ? (
        <div className="text-sm text-body">{entry.subheading}</div>
      ) : null}
      {entry.meta ? (
        <div className="mt-1 text-xs text-muted-foreground">{entry.meta}</div>
      ) : null}
      {entry.details.length > 0 ? (
        <ul className="mt-2 grid list-disc gap-1 pl-5 text-sm leading-6 text-body">
          {entry.details.map((detail, i) => (
            <li key={i}>{detail}</li>
          ))}
        </ul>
      ) : null}
      <Flags flags={entry.flags} />
    </li>
  );
}

const TRIGGER =
  "items-center rounded-none px-4 py-4 text-[0.9375rem] hover:no-underline focus-visible:ring-offset-0 sm:px-6";
const CONTENT = "h-auto px-4 pb-5 sm:px-6";

/**
 * "How ATS systems may read your resume" — docs/PLANNING.md §7.3, section 9. Collapsed by
 * default except contact details.
 */
export function ParsedResumeSection({ parsed }: { parsed: ParsedResumeView | null }) {
  return (
    <section id="parsed-resume" aria-labelledby="parsed-title" className="scroll-mt-20">
      <SectionHeading
        id="parsed-title"
        as="h2"
        size="h3"
        title="Parsed resume"
        description="How ATS systems may read your resume. If something here is wrong or missing, an ATS may get it wrong too."
      />

      {parsed === null ? (
        <p className="mt-6 rounded-lg border border-border bg-background p-6 text-sm text-subtle">
          The resume behind this report is no longer stored, so its parsed contents
          aren&apos;t available.
        </p>
      ) : (
        <Accordion
          type="multiple"
          defaultValue={["contact"]}
          className="mt-6 rounded-lg border border-border bg-background"
        >
          <AccordionItem value="contact" className="border-border">
            <AccordionTrigger className={TRIGGER}>Contact</AccordionTrigger>
            <AccordionContent className={CONTENT}>
              {parsed.contact.length > 0 ? (
                <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[8rem_minmax(0,1fr)]">
                  {parsed.contact.map((field) => (
                    <div key={`${field.label}-${field.value}`} className="contents">
                      <dt className="text-subtle">{field.label}</dt>
                      <dd className="mb-2 wrap-break-word text-foreground sm:mb-0">
                        {field.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <div className="text-sm text-subtle">No contact details were found.</div>
              )}
              <Flags flags={parsed.contactFlags} />
            </AccordionContent>
          </AccordionItem>

          {parsed.sections.map((section) => (
            <AccordionItem
              key={section.kind}
              value={section.kind}
              className="border-border"
            >
              <AccordionTrigger className={TRIGGER}>{section.label}</AccordionTrigger>
              <AccordionContent className={CONTENT}>
                {section.text ? (
                  <div className="text-sm leading-6 text-body">{section.text}</div>
                ) : null}
                {section.list ? (
                  <div className="text-sm leading-6 text-body">
                    {section.list.join(", ")}
                  </div>
                ) : null}
                {section.entries.length > 0 ? (
                  <ul className="divide-y divide-border">
                    {section.entries.map((entry, i) => (
                      <Entry key={i} entry={entry} />
                    ))}
                  </ul>
                ) : null}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {parsed && parsed.otherSections.length > 0 ? (
        <p className="mt-4 text-sm text-subtle">
          Also found: {parsed.otherSections.join(", ")}. These sections are recognized but
          their contents aren&apos;t broken down.
        </p>
      ) : null}
    </section>
  );
}

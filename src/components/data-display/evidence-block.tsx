import { cn } from "cn";

type EvidenceBlockProps = {
  /** Exact text quoted from the resume or job description. */
  text: string;
  /** Where the text was found, e.g. "Experience › Acme Corp › bullet 2". */
  location?: string;
  className?: string;
};

export function EvidenceBlock({ text, location, className }: EvidenceBlockProps) {
  return (
    <figure
      className={cn("rounded-md border border-border bg-soft px-4 py-3", className)}
    >
      <blockquote className="text-sm leading-6 text-body">
        <p>
          <span aria-hidden="true">“</span>
          {text}
          <span aria-hidden="true">”</span>
        </p>
      </blockquote>
      {location ? (
        <figcaption className="mt-2 text-xs text-subtle">{location}</figcaption>
      ) : null}
    </figure>
  );
}

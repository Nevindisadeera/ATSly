import { cn } from "cn";

import { Container } from "./container";

type ProsePageProps = {
  eyebrow?: string;
  title: string;
  lead?: string;
  updated?: string;
  children: React.ReactNode;
};

/** Long-form reading layout for methodology and legal pages: 720px column, generous rhythm. */
export function ProsePage({ eyebrow, title, lead, updated, children }: ProsePageProps) {
  return (
    <Container width="reading" className="py-16 md:py-24">
      <header className="border-b border-border pb-10">
        {eyebrow ? <p className="type-caption text-muted-foreground">{eyebrow}</p> : null}
        <h1 className="mt-4 type-h1 text-balance">{title}</h1>
        {lead ? <p className="mt-5 type-lead text-pretty text-subtle">{lead}</p> : null}
        {updated ? (
          <p className="mt-5 text-sm text-subtle">Last updated {updated}</p>
        ) : null}
      </header>
      <Prose className="pt-4">{children}</Prose>
    </Container>
  );
}

/** Typographic defaults for article content without a typography plugin. */
export function Prose({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "text-body",
        "[&_h2]:mt-14 [&_h2]:scroll-mt-24 [&_h2]:type-h3",
        "[&_h3]:mt-10 [&_h3]:type-h4",
        "[&_p]:mt-4 [&_p]:leading-7",
        "[&_ul]:mt-4 [&_ul]:grid [&_ul]:gap-2 [&_ul]:pl-5 [&_ul]:leading-7 [&_ul_li]:list-disc [&_ul_li]:pl-1 [&_ul_li]:marker:text-slate-400",
        "[&_ol]:mt-4 [&_ol]:grid [&_ol]:gap-2 [&_ol]:pl-5 [&_ol]:leading-7 [&_ol_li]:list-decimal [&_ol_li]:pl-1",
        "[&_strong]:font-medium [&_strong]:text-foreground",
        "[&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-4 [&_a:hover]:underline",
        className,
      )}
      {...props}
    />
  );
}

import { cn } from "cn";

type EmptyStateProps = {
  title: string;
  description?: string;
  /** Usually a single Button. */
  action?: React.ReactNode;
  /** Optional small icon (20px, muted). No illustrations. */
  icon?: React.ReactNode;
  /** Heading level for the title so it fits the page outline. */
  headingLevel?: 2 | 3 | 4;
  className?: string;
};

export function EmptyState({
  title,
  description,
  action,
  icon,
  headingLevel = 3,
  className,
}: EmptyStateProps) {
  const Heading = `h${headingLevel}` as const;
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-lg border border-border bg-background px-6 py-12 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="mb-4 text-muted-foreground [&_svg]:size-5" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <Heading className="type-h4">{title}</Heading>
      {description ? (
        <p className="mt-2 max-w-sm text-sm leading-6 text-subtle">{description}</p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

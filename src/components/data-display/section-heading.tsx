import { cn } from "cn";

type SectionHeadingProps = {
  title: React.ReactNode;
  eyebrow?: string;
  description?: React.ReactNode;
  /** Heading element. Visual size follows the level unless `size` is given. */
  as?: "h1" | "h2" | "h3";
  size?: "display" | "h1" | "h2" | "h3";
  align?: "left" | "center";
  /** Set to reference this heading from a section's aria-labelledby. */
  id?: string;
  className?: string;
};

const SIZE_CLASS = {
  display: "type-display",
  h1: "type-h1",
  h2: "type-h2",
  h3: "type-h3",
} as const;

export function SectionHeading({
  title,
  eyebrow,
  description,
  as: Heading = "h2",
  size,
  align = "left",
  id,
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        align === "center" && "items-center text-center",
        className,
      )}
    >
      {eyebrow ? <p className="type-caption text-muted-foreground">{eyebrow}</p> : null}
      <Heading id={id} className={cn(SIZE_CLASS[size ?? Heading], "text-balance")}>
        {title}
      </Heading>
      {description ? (
        <p
          className={cn(
            "max-w-2xl type-lead text-pretty text-subtle",
            align === "center" && "mx-auto",
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}

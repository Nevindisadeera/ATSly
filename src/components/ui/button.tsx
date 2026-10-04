import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Loader2 } from "lucide-react";
import { Slot } from "radix-ui";

// Variants and sizes follow docs/PLANNING.md §11. Blue fill is reserved for the
// single primary action in a view; everything else is navy outline, ghost or link.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-transparent font-medium whitespace-nowrap transition-colors duration-150 outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:not-data-loading:opacity-50 data-loading:cursor-wait aria-disabled:pointer-events-none aria-disabled:opacity-60 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary-hover",
        secondary:
          "border-navy/90 bg-background text-foreground hover:bg-soft aria-expanded:bg-soft",
        outline:
          "border-border-strong bg-background text-foreground hover:border-subtle/40 hover:bg-soft aria-expanded:bg-soft",
        ghost: "text-foreground hover:bg-track aria-expanded:bg-track",
        "danger-outline":
          "border-danger/60 bg-background text-danger-strong hover:border-danger hover:bg-danger-soft focus-visible:ring-danger",
        link: "h-auto rounded-sm px-0 text-primary underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-base",
        icon: "size-10",
        "icon-sm": "size-8",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /** Icon rendered before the label. Replaced by a spinner while loading. */
    leadingIcon?: React.ReactNode;
    /** Shows a spinner, sets aria-busy and blocks interaction. The label stays, so width is preserved. */
    loading?: boolean;
  };

function Button({
  className,
  variant = "primary",
  size = "md",
  asChild = false,
  leadingIcon,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size }), className);

  if (asChild) {
    return (
      <Slot.Root
        data-slot="button"
        data-variant={variant}
        data-size={size}
        className={classes}
        {...props}
      >
        {children}
      </Slot.Root>
    );
  }

  return (
    <button
      data-slot="button"
      data-variant={variant}
      data-size={size}
      data-loading={loading || undefined}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={classes}
      {...props}
    >
      {loading ? <Loader2 aria-hidden="true" className="animate-spin" /> : leadingIcon}
      {children}
    </button>
  );
}

export { Button, buttonVariants };
export type { ButtonProps };

import { cn } from "cn";

const WIDTHS = {
  marketing: "max-w-[1200px]",
  app: "max-w-[1120px]",
  reading: "max-w-[720px]",
} as const;

type ContainerProps = React.ComponentProps<"div"> & {
  width?: keyof typeof WIDTHS;
};

/** Centered page column with the standard side gutters (16px on phones). */
export function Container({ width = "marketing", className, ...props }: ContainerProps) {
  return (
    <div
      className={cn("mx-auto w-full px-4 sm:px-6 lg:px-8", WIDTHS[width], className)}
      {...props}
    />
  );
}

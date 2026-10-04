import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { cn } from "cn";

import { Skeleton } from "@/components/ui/skeleton";

type Trend = {
  direction: "up" | "down" | "flat";
  /** Short description, e.g. "+6 since last scan". */
  text: string;
};

type MetricCardProps = {
  label: string;
  value?: React.ReactNode;
  hint?: string;
  trend?: Trend;
  loading?: boolean;
  className?: string;
};

const TREND_ICON = { up: ArrowUpRight, down: ArrowDownRight, flat: ArrowRight };

export function MetricCard({
  label,
  value,
  hint,
  trend,
  loading = false,
  className,
}: MetricCardProps) {
  const TrendIcon = trend ? TREND_ICON[trend.direction] : null;

  return (
    <div
      className={cn("rounded-lg border border-border bg-background p-5", className)}
      aria-busy={loading || undefined}
    >
      <p className="text-sm text-subtle">{label}</p>
      {loading ? (
        <>
          <Skeleton className="mt-3 h-9 w-20" />
          <Skeleton className="mt-3 h-4 w-32" />
          <span className="sr-only">Loading {label}</span>
        </>
      ) : (
        <>
          <p className="mt-2 type-score-md text-foreground">{value ?? "—"}</p>
          {trend && TrendIcon ? (
            <p className="mt-2 inline-flex items-center gap-1 text-sm text-body">
              <TrendIcon aria-hidden="true" className="size-4 text-muted-foreground" />
              {trend.text}
            </p>
          ) : hint ? (
            <p className="mt-2 text-sm text-muted-foreground">{hint}</p>
          ) : null}
        </>
      )}
    </div>
  );
}

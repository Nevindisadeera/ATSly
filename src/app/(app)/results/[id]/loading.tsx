import { Container } from "@/components/layout/container";
import { Skeleton } from "@/components/ui/skeleton";

/** Shown while the report loads from the database. */
export default function ResultsLoading() {
  return (
    <Container width="app" className="py-8 md:py-12" aria-busy="true">
      <span className="sr-only" role="status">
        Loading your report…
      </span>
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-3 h-8 w-72 max-w-full" />
      <Skeleton className="mt-3 h-4 w-56 max-w-full" />
      <div className="mt-10 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-12">
        <div className="hidden gap-2 lg:grid lg:content-start">
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
        <div className="grid max-w-[840px] gap-6">
          <div className="grid gap-8 rounded-lg border border-border bg-background p-6 sm:p-8 md:grid-cols-[auto_minmax(0,1fr)]">
            <Skeleton className="mx-auto size-[120px] rounded-full sm:size-[168px]" />
            <div className="grid content-start gap-3">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="mt-4 h-4 w-40" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          </div>
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </div>
    </Container>
  );
}

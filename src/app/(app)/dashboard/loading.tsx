import { Container } from "@/components/layout/container";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <Container width="app" className="grid gap-8 py-8 md:py-12" aria-busy="true">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-44 w-full rounded-lg" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
      </div>
      <Skeleton className="h-64 w-full rounded-lg" />
      <span className="sr-only">Loading your dashboard</span>
    </Container>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LatestScanCard } from "@/components/dashboard/latest-scan-card";
import { RecentScans } from "@/components/dashboard/recent-scans";
import { ScoreTrendChart } from "@/components/dashboard/score-trend-chart";
import { EmptyState, MetricCard } from "@/components/data-display";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { currentOwner } from "@/lib/auth/current-owner";
import { isAppError } from "@/lib/http/errors";
import { getAccount } from "@/lib/services/account-service";
import { getOverview } from "@/lib/services/dashboard-service";

export const metadata: Metadata = { title: "Dashboard" };

const SIGN_IN = "/login?next=%2Fdashboard";

/** /dashboard — docs/PLANNING.md §7.4. Read through services, not HTTP (§22). */
export default async function DashboardPage() {
  const owner = await currentOwner();
  if (owner?.type !== "user") redirect(SIGN_IN);

  const [account, overview] = await Promise.all([
    getAccount(owner.id).catch((error: unknown) => {
      // A session whose account was deleted.
      if (isAppError(error) && error.code === "UNAUTHENTICATED") return null;
      throw error;
    }),
    getOverview(owner),
  ]);
  if (!account) redirect(SIGN_IN);

  const firstName = account.name.split(/\s+/)[0] ?? account.name;
  const { latest, stats, recent } = overview;
  const empty = recent.items.length === 0;

  return (
    <Container width="app" className="grid gap-8 py-8 md:py-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="type-h2">Welcome back, {firstName}.</h1>
        {empty ? null : (
          <Button asChild className="w-full sm:w-fit">
            <Link href="/scan">Scan a resume</Link>
          </Button>
        )}
      </div>

      {empty ? (
        <EmptyState
          headingLevel={2}
          title="No scans yet."
          description="Upload a resume to get your first ATS report."
          action={
            <Button asChild>
              <Link href="/scan">Scan a resume</Link>
            </Button>
          }
        />
      ) : (
        <>
          {latest ? <LatestScanCard scan={latest} /> : null}

          {stats.scans >= 2 ? (
            <section aria-labelledby="stats-title">
              <h2 id="stats-title" className="sr-only">
                Your scores
              </h2>
              <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,2fr)]">
                <MetricCard label="Scans" value={stats.scans} />
                <MetricCard
                  label="Best ATS score"
                  value={stats.bestAtsScore ?? undefined}
                />
                <MetricCard
                  label="Average match"
                  value={stats.averageMatch ?? undefined}
                  hint={
                    stats.averageMatch === null ? "No job descriptions yet" : undefined
                  }
                />
                {stats.trend.length >= 3 ? (
                  <div className="rounded-lg border border-border bg-background p-5 sm:col-span-3 lg:col-span-1">
                    <p className="text-sm text-subtle">ATS score trend</p>
                    <div className="mt-3">
                      <ScoreTrendChart points={stats.trend} />
                    </div>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          <RecentScans initial={recent} />
        </>
      )}
    </Container>
  );
}

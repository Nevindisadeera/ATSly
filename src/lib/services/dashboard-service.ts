import "server-only";

import type { Owner } from "@/lib/auth/owner";
import { scanRepository, type ScanListRow } from "@/lib/db/repositories/scan-repository";
import { AppError } from "@/lib/http/errors";
import type { DashboardOverview, ScanListItem, ScanListPage } from "@/types/api";

/**
 * The dashboard — docs/PLANNING.md §7.4 and §22: recent scans a page at a time, and the
 * stats above them. Lists read the denormalized summary, never the embedded reports.
 */

export const SCAN_PAGE = { default: 20, max: 50 } as const;
/** Points on the score trend chart. */
const TREND_POINTS = 12;
const RECENT_ON_DASHBOARD = 10;

export function toListItem(row: ScanListRow): ScanListItem {
  return {
    id: row.id,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    resume: { id: row.resumeId, fileName: row.resumeSnapshot.fileName },
    job: row.jobDescriptionId
      ? {
          id: row.jobDescriptionId,
          title: row.jobSnapshot?.title ?? null,
          company: row.jobSnapshot?.company ?? null,
        }
      : null,
    atsScore: row.summary?.atsScore ?? null,
    atsBand: row.summary?.atsBand ?? null,
    matchScore: row.summary?.matchScore ?? null,
    matchBand: row.summary?.matchBand ?? null,
    topAction: row.summary?.topActions[0] ?? null,
    error: row.error?.code ?? null,
  };
}

/** Opaque to clients: the last row's time and id, base64url-encoded. */
export function encodeCursor(row: { createdAt: Date; id: string }): string {
  return Buffer.from(`${row.createdAt.getTime()}.${row.id}`).toString("base64url");
}

export function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
  const match = /^(\d{1,15})\.([0-9a-f]{24})$/i.exec(
    Buffer.from(cursor, "base64url").toString("utf8"),
  );
  if (!match) return null;
  return { createdAt: new Date(Number(match[1])), id: match[2]! };
}

export async function listScans(
  owner: Owner,
  options: { limit?: number; cursor?: string | null } = {},
): Promise<ScanListPage> {
  const limit = Math.min(Math.max(options.limit ?? SCAN_PAGE.default, 1), SCAN_PAGE.max);
  const before = options.cursor ? decodeCursor(options.cursor) : undefined;
  if (before === null) {
    throw new AppError("INVALID_INPUT", { message: "That page cursor isn't valid." });
  }
  // One extra row says whether there is another page.
  const rows = await scanRepository.listForOwner(owner, { limit: limit + 1, before });
  const page = rows.slice(0, limit);
  return {
    items: page.map(toListItem),
    nextCursor: rows.length > limit ? encodeCursor(page.at(-1)!) : null,
  };
}

const average = (values: number[]) =>
  values.length === 0
    ? null
    : Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);

export async function getOverview(owner: Owner): Promise<DashboardOverview> {
  const [recent, latest, scores, completeCount] = await Promise.all([
    listScans(owner, { limit: RECENT_ON_DASHBOARD }),
    scanRepository.listForOwner(owner, { limit: 1, status: "complete" }),
    scanRepository.scoresForOwner(owner),
    scanRepository.countForOwner(owner, "complete"),
  ]);

  return {
    latest: latest[0] ? toListItem(latest[0]) : null,
    stats: {
      scans: completeCount,
      bestAtsScore: scores.length ? Math.max(...scores.map((s) => s.atsScore)) : null,
      averageMatch: average(
        scores.map((s) => s.matchScore).filter((v): v is number => v !== null),
      ),
      trend: scores
        .slice(0, TREND_POINTS)
        .reverse()
        .map((s) => ({ date: s.createdAt.toISOString(), atsScore: s.atsScore })),
    },
    recent,
  };
}

export async function deleteScanForOwner(owner: Owner, id: string): Promise<void> {
  if (!(await scanRepository.deleteForOwner(owner, id))) throw new AppError("NOT_FOUND");
}

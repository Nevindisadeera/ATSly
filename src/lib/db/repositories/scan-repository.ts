import "server-only";

import type { AtsReport } from "@/lib/ats";
import type { Owner } from "@/lib/auth/owner";
import type { MatchReport } from "@/lib/matching";
import type {
  ScanAiRecord,
  ScanError,
  ScanStage,
  ScanStatus,
  ScanSummary,
} from "@/types/api";

import { ScanModel, type ScanDocument } from "../models/scan";
import { withDb } from "../with-db";

/** A scan as the application sees it: typed, with string ids. */
export type StoredScan = {
  id: string;
  owner: Owner;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  resumeId: string;
  jobDescriptionId: string | null;
  jobSnapshot: { title: string | null; company: string | null } | null;
  status: ScanStatus;
  stage: ScanStage | null;
  error: ScanError | null;
  engineVersion: string;
  ats: AtsReport | null;
  match: MatchReport | null;
  ai: ScanAiRecord | null;
  model: string | null;
  promptVersion: string | null;
  summary: ScanSummary | null;
  resumeSnapshot: { fileName: string; pageCount: number; wordCount: number };
  durationMs: number | null;
};

export type NewScan = Pick<
  StoredScan,
  "owner" | "expiresAt" | "resumeId" | "engineVersion" | "resumeSnapshot"
> &
  Partial<Pick<StoredScan, "jobDescriptionId" | "jobSnapshot">>;

export type ScanResult = {
  ats: AtsReport;
  match?: MatchReport;
  summary: ScanSummary;
  ai: ScanAiRecord;
  /** The AI model and prompt version used, for reproducibility (§16.4). */
  model?: string | null;
  promptVersion?: string | null;
  durationMs: number;
};

/** A scan as lists show it: the denormalized summary, never the report (§16.4). */
export type ScanListRow = Pick<
  StoredScan,
  | "id"
  | "createdAt"
  | "status"
  | "error"
  | "resumeId"
  | "jobDescriptionId"
  | "jobSnapshot"
  | "summary"
  | "resumeSnapshot"
>;

/** Lists skip the embedded report, the bulk of every document. */
const LIST_PROJECTION = { ats: 0, match: 0, ai: 0 } as const;

const OBJECT_ID = /^[0-9a-f]{24}$/i;
const IN_PROGRESS: ScanStatus[] = ["queued", "running"];

function toStored(doc: ScanDocument): StoredScan {
  return {
    id: String(doc._id),
    owner: { type: doc.owner.type, id: doc.owner.id },
    expiresAt: doc.expiresAt ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    resumeId: String(doc.resumeId),
    jobDescriptionId: doc.jobDescriptionId ? String(doc.jobDescriptionId) : null,
    jobSnapshot: doc.jobSnapshot
      ? { title: doc.jobSnapshot.title ?? null, company: doc.jobSnapshot.company ?? null }
      : null,
    status: doc.status,
    stage: doc.stage ?? null,
    error: doc.error
      ? {
          code: doc.error.code,
          message: doc.error.message,
          retryable: doc.error.retryable,
        }
      : null,
    engineVersion: doc.engineVersion,
    ats: (doc.ats as AtsReport | undefined) ?? null,
    match: (doc.match as MatchReport | undefined) ?? null,
    ai: doc.ai ? { ...doc.ai } : null,
    model: doc.model ?? null,
    promptVersion: doc.promptVersion ?? null,
    summary: doc.summary ?? null,
    resumeSnapshot: { ...doc.resumeSnapshot },
    durationMs: doc.durationMs ?? null,
  };
}

const ownerFilter = (owner: Owner) => ({
  "owner.type": owner.type,
  "owner.id": owner.id,
});

/**
 * Reads are scoped by owner: someone else's scan is indistinguishable from one that doesn't
 * exist. The pipeline methods (markRunning, setStage, complete, fail) take only an id: the
 * pipeline runs on ids the server itself created, never on ids from a request.
 */
export const scanRepository = {
  create(data: NewScan): Promise<StoredScan> {
    return withDb(async () => {
      const doc = await ScanModel.create({
        ...data,
        expiresAt: data.expiresAt ?? undefined,
        jobDescriptionId: data.jobDescriptionId ?? undefined,
        jobSnapshot: data.jobSnapshot
          ? {
              title: data.jobSnapshot.title ?? undefined,
              company: data.jobSnapshot.company ?? undefined,
            }
          : undefined,
        status: "queued",
        stage: null,
      });
      return toStored(doc.toObject() as ScanDocument);
    });
  },

  findForOwner(owner: Owner, id: string): Promise<StoredScan | null> {
    if (!OBJECT_ID.test(id)) return Promise.resolve(null);
    return withDb(async () => {
      const doc = await ScanModel.findOne({
        _id: id,
        ...ownerFilter(owner),
      }).lean<ScanDocument>();
      return doc ? toStored(doc) : null;
    });
  },

  /** Claims a queued scan for processing. Returns null if it was already claimed or ended. */
  markRunning(id: string): Promise<StoredScan | null> {
    return withDb(async () => {
      const doc = await ScanModel.findOneAndUpdate(
        { _id: id, status: "queued" },
        { $set: { status: "running", stage: "ats_rules" } },
        { returnDocument: "after" },
      ).lean<ScanDocument>();
      return doc ? toStored(doc) : null;
    });
  },

  /** Records progress. False when the scan is no longer running (e.g. it timed out). */
  setStage(id: string, stage: ScanStage): Promise<boolean> {
    return withDb(async () => {
      const result = await ScanModel.updateOne(
        { _id: id, status: "running" },
        { $set: { stage } },
      );
      return result.matchedCount === 1;
    });
  },

  /** Stores the finished report. False when the scan is no longer running. */
  complete(id: string, result: ScanResult): Promise<boolean> {
    return withDb(async () => {
      const update = await ScanModel.updateOne(
        { _id: id, status: "running" },
        { $set: { ...result, status: "complete", stage: null } },
      );
      return update.matchedCount === 1;
    });
  },

  /** Marks a queued or running scan as failed. A scan that already ended is left as it is. */
  fail(id: string, error: ScanError, durationMs?: number): Promise<boolean> {
    return withDb(async () => {
      const update = await ScanModel.updateOne(
        { _id: id, status: { $in: IN_PROGRESS } },
        { $set: { status: "failed", error, ...(durationMs ? { durationMs } : {}) } },
      );
      return update.matchedCount === 1;
    });
  },

  /**
   * The stale sweep — docs/PLANNING.md §22. A queued or running scan that hasn't progressed
   * since `cutoff` is marked failed. Returns the updated scan, or null if it wasn't stale.
   */
  failIfStale(
    owner: Owner,
    id: string,
    cutoff: Date,
    error: ScanError,
  ): Promise<StoredScan | null> {
    return withDb(async () => {
      const doc = await ScanModel.findOneAndUpdate(
        {
          _id: id,
          ...ownerFilter(owner),
          status: { $in: IN_PROGRESS },
          updatedAt: { $lt: cutoff },
        },
        { $set: { status: "failed", error } },
        { returnDocument: "after" },
      ).lean<ScanDocument>();
      return doc ? toStored(doc) : null;
    });
  },

  /** Deletes every scan of one resume, for the resume's owner. Returns how many went. */
  deleteForResume(owner: Owner, resumeId: string): Promise<number> {
    if (!OBJECT_ID.test(resumeId)) return Promise.resolve(0);
    return withDb(async () => {
      const result = await ScanModel.deleteMany({ resumeId, ...ownerFilter(owner) });
      return result.deletedCount;
    });
  },
  /**
   * One page of the owner's scans, newest first. `before` continues after the last row of
   * the previous page: same timestamps are ordered by id, so no row is skipped or repeated.
   */
  listForOwner(
    owner: Owner,
    options: {
      limit: number;
      before?: { createdAt: Date; id: string };
      status?: ScanStatus;
    },
  ): Promise<ScanListRow[]> {
    return withDb(async () => {
      const { before } = options;
      const docs = await ScanModel.find(
        {
          ...ownerFilter(owner),
          ...(options.status ? { status: options.status } : {}),
          ...(before
            ? {
                $or: [
                  { createdAt: { $lt: before.createdAt } },
                  { createdAt: before.createdAt, _id: { $lt: before.id } },
                ],
              }
            : {}),
        },
        LIST_PROJECTION,
      )
        .sort({ createdAt: -1, _id: -1 })
        .limit(options.limit)
        .lean<ScanDocument[]>();
      return docs.map((doc) => {
        const scan = toStored(doc);
        return {
          id: scan.id,
          createdAt: scan.createdAt,
          status: scan.status,
          error: scan.error,
          resumeId: scan.resumeId,
          jobDescriptionId: scan.jobDescriptionId,
          jobSnapshot: scan.jobSnapshot,
          summary: scan.summary,
          resumeSnapshot: scan.resumeSnapshot,
        };
      });
    });
  },

  /** Scores of the owner's complete scans, newest first, for dashboard stats. */
  scoresForOwner(
    owner: Owner,
    limit = 500,
  ): Promise<{ createdAt: Date; atsScore: number; matchScore: number | null }[]> {
    return withDb(async () => {
      const docs = await ScanModel.find(
        { ...ownerFilter(owner), status: "complete" },
        { createdAt: 1, "summary.atsScore": 1, "summary.matchScore": 1 },
      )
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit)
        .lean<Pick<ScanDocument, "createdAt" | "summary">[]>();
      return docs
        .filter((doc) => typeof doc.summary?.atsScore === "number")
        .map((doc) => ({
          createdAt: doc.createdAt,
          atsScore: doc.summary!.atsScore,
          matchScore: doc.summary!.matchScore ?? null,
        }));
    });
  },

  countForOwner(owner: Owner, status?: ScanStatus): Promise<number> {
    return withDb(() =>
      ScanModel.countDocuments({ ...ownerFilter(owner), ...(status ? { status } : {}) }),
    );
  },

  deleteForOwner(owner: Owner, id: string): Promise<boolean> {
    if (!OBJECT_ID.test(id)) return Promise.resolve(false);
    return withDb(async () => {
      const result = await ScanModel.deleteOne({ _id: id, ...ownerFilter(owner) });
      return result.deletedCount === 1;
    });
  },

  deleteAllForOwner(owner: Owner): Promise<number> {
    return withDb(
      async () => (await ScanModel.deleteMany(ownerFilter(owner))).deletedCount,
    );
  },

  /**
   * Moves all of one owner's scans to another (a guest signing in) and drops the
   * guest deletion date. Returns how many moved; running it again moves nothing.
   */
  reown(from: Owner, to: Owner): Promise<number> {
    return withDb(async () => {
      const result = await ScanModel.updateMany(ownerFilter(from), {
        $set: { owner: to },
        $unset: { expiresAt: 1 },
      });
      return result.modifiedCount;
    });
  },
};

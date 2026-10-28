import "server-only";

import type { Owner } from "@/lib/auth/owner";
import type { JobRequirements } from "@/lib/matching";

import {
  JobDescriptionModel,
  type JobDescriptionDocument,
} from "../models/job-description";
import { withDb } from "../with-db";

export type StoredJobDescription = {
  id: string;
  owner: Owner;
  expiresAt: Date | null;
  createdAt: Date;
  title: string | null;
  company: string | null;
  rawText: string;
  normalizedHash: string;
  extracted: JobRequirements;
  extractionSource: "ai" | "rules";
  extractorVersion: string;
};

export type NewJobDescription = Omit<StoredJobDescription, "id" | "createdAt">;

const OBJECT_ID = /^[0-9a-f]{24}$/i;

function toStored(doc: JobDescriptionDocument): StoredJobDescription {
  return {
    id: String(doc._id),
    owner: { type: doc.owner.type, id: doc.owner.id },
    expiresAt: doc.expiresAt ?? null,
    createdAt: doc.createdAt,
    title: doc.title ?? null,
    company: doc.company ?? null,
    rawText: doc.rawText,
    normalizedHash: doc.normalizedHash,
    extracted: doc.extracted as JobRequirements,
    extractionSource: doc.extractionSource,
    extractorVersion: doc.extractorVersion,
  };
}

const ownerFilter = (owner: Owner) => ({
  "owner.type": owner.type,
  "owner.id": owner.id,
});

/** Every query is scoped by owner, like resumes and scans. */
export const jobDescriptionRepository = {
  create(data: NewJobDescription): Promise<StoredJobDescription> {
    return withDb(async () => {
      const doc = await JobDescriptionModel.create({
        ...data,
        expiresAt: data.expiresAt ?? undefined,
        title: data.title ?? undefined,
        company: data.company ?? undefined,
      });
      return toStored(doc.toObject() as JobDescriptionDocument);
    });
  },

  findForOwner(owner: Owner, id: string): Promise<StoredJobDescription | null> {
    if (!OBJECT_ID.test(id)) return Promise.resolve(null);
    return withDb(async () => {
      const doc = await JobDescriptionModel.findOne({
        _id: id,
        ...ownerFilter(owner),
      }).lean<JobDescriptionDocument>();
      return doc ? toStored(doc) : null;
    });
  },

  /** The same posting pasted again by the same owner, extracted by the same rules. */
  findDuplicate(
    owner: Owner,
    normalizedHash: string,
    extractorVersion: string,
  ): Promise<StoredJobDescription | null> {
    return withDb(async () => {
      const doc = await JobDescriptionModel.findOne({
        ...ownerFilter(owner),
        normalizedHash,
        extractorVersion,
      })
        .sort({ createdAt: -1 })
        .lean<JobDescriptionDocument>();
      return doc ? toStored(doc) : null;
    });
  },

  /** Replaces the rules extraction with a merged AI one (Phase 10a). */
  saveExtraction(
    owner: Owner,
    id: string,
    update: {
      extracted: JobRequirements;
      extractionSource: "ai" | "rules";
      promptVersion: string;
    },
  ): Promise<void> {
    return withDb(async () => {
      await JobDescriptionModel.updateOne(
        { _id: id, ...ownerFilter(owner) },
        { $set: update },
      );
    });
  },

  extendExpiry(owner: Owner, id: string, expiresAt: Date): Promise<void> {
    return withDb(async () => {
      await JobDescriptionModel.updateOne(
        { _id: id, ...ownerFilter(owner) },
        { $set: { expiresAt } },
      );
    });
  },
  /**
   * Moves all of one owner's job descriptions to another (a guest signing in) and drops the
   * guest deletion date. Returns how many moved; running it again moves nothing.
   */
  reown(from: Owner, to: Owner): Promise<number> {
    return withDb(async () => {
      const result = await JobDescriptionModel.updateMany(ownerFilter(from), {
        $set: { owner: to },
        $unset: { expiresAt: 1 },
      });
      return result.modifiedCount;
    });
  },
};

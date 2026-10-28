import "server-only";

import type { Owner } from "@/lib/auth/owner";
import type { LayoutProbe, ParsedResume } from "@/lib/parsing";

import { ResumeModel, type ResumeDocument } from "../models/resume";
import { withDb } from "../with-db";

/** A resume as the application sees it: typed, with a string id. */
export type StoredResume = {
  id: string;
  owner: Owner;
  expiresAt: Date | null;
  createdAt: Date;
  file: {
    originalName: string;
    extension: "pdf" | "docx";
    mimeType: string;
    sizeBytes: number;
    sha256: string;
    pageCount: number;
  };
  extraction: {
    engine: "pdfjs" | "ooxml";
    text: string;
    wordCount: number;
    charCount: number;
    warnings: string[];
    layout: LayoutProbe;
  };
  parsed: ParsedResume;
  parserVersion: string;
  language: "en" | "other";
};

export type NewResume = Omit<StoredResume, "id" | "createdAt">;

const OBJECT_ID = /^[0-9a-f]{24}$/i;

function toStored(doc: ResumeDocument): StoredResume {
  return {
    id: String(doc._id),
    owner: { type: doc.owner.type as Owner["type"], id: doc.owner.id },
    expiresAt: doc.expiresAt ?? null,
    createdAt: doc.createdAt,
    file: {
      ...doc.file,
      extension: doc.file.extension as "pdf" | "docx",
      mimeType: doc.file.mimeType ?? "",
    },
    extraction: {
      engine: doc.extraction.engine as "pdfjs" | "ooxml",
      text: doc.extraction.text ?? "",
      wordCount: doc.extraction.wordCount,
      charCount: doc.extraction.charCount,
      warnings: [...(doc.extraction.warnings ?? [])],
      layout: doc.extraction.layout as LayoutProbe,
    },
    parsed: doc.parsed as ParsedResume,
    parserVersion: doc.parserVersion,
    language: doc.language as "en" | "other",
  };
}

const ownerFilter = (owner: Owner) => ({
  "owner.type": owner.type,
  "owner.id": owner.id,
});

/**
 * Every query is scoped by owner. A resume owned by someone else is indistinguishable from
 * one that doesn't exist, so callers return 404 for both and nothing leaks.
 */
export const resumeRepository = {
  create(data: NewResume): Promise<StoredResume> {
    return withDb(async () => {
      const doc = await ResumeModel.create({
        ...data,
        expiresAt: data.expiresAt ?? undefined,
      });
      return toStored(doc.toObject() as ResumeDocument);
    });
  },

  findForOwner(owner: Owner, id: string): Promise<StoredResume | null> {
    if (!OBJECT_ID.test(id)) return Promise.resolve(null);
    return withDb(async () => {
      const doc = await ResumeModel.findOne({
        _id: id,
        ...ownerFilter(owner),
      }).lean<ResumeDocument>();
      return doc ? toStored(doc) : null;
    });
  },

  /** The same file uploaded again by the same owner and parsed by the same parser version. */
  findDuplicate(
    owner: Owner,
    sha256: string,
    parserVersion: string,
  ): Promise<StoredResume | null> {
    return withDb(async () => {
      const doc = await ResumeModel.findOne({
        ...ownerFilter(owner),
        "file.sha256": sha256,
        parserVersion,
      })
        .sort({ createdAt: -1 })
        .lean<ResumeDocument>();
      return doc ? toStored(doc) : null;
    });
  },

  /** Pushes a guest resume's deletion date forward when it is used again. */
  extendExpiry(owner: Owner, id: string, expiresAt: Date): Promise<void> {
    return withDb(async () => {
      await ResumeModel.updateOne(
        { _id: id, ...ownerFilter(owner) },
        { $set: { expiresAt } },
      );
    });
  },

  deleteForOwner(owner: Owner, id: string): Promise<boolean> {
    if (!OBJECT_ID.test(id)) return Promise.resolve(false);
    return withDb(async () => {
      const result = await ResumeModel.deleteOne({ _id: id, ...ownerFilter(owner) });
      return result.deletedCount === 1;
    });
  },
  /**
   * Moves all of one owner's resumes to another (a guest signing in) and drops the
   * guest deletion date. Returns how many moved; running it again moves nothing.
   */
  reown(from: Owner, to: Owner): Promise<number> {
    return withDb(async () => {
      const result = await ResumeModel.updateMany(ownerFilter(from), {
        $set: { owner: to },
        $unset: { expiresAt: 1 },
      });
      return result.modifiedCount;
    });
  },
};

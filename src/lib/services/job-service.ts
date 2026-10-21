import "server-only";

import { createHash } from "node:crypto";

import type { Owner } from "@/lib/auth/owner";
import {
  jobDescriptionRepository,
  type StoredJobDescription,
} from "@/lib/db/repositories/job-description-repository";
import { logger } from "@/lib/logging/logger";
import {
  extractJobRequirements,
  MATCH_ENGINE_VERSION,
  normalizeJobText,
} from "@/lib/matching";

import { guestExpiry } from "./retention";

export type JobDescriptionInput = { text: string; title?: string; company?: string };

type Context = { requestId: string; owner: Owner };

const clean = (value: string | undefined) => value?.trim() || null;

/** sha256 of the normalized posting and title, lowercased — docs/PLANNING.md §16.3. */
export function jobDescriptionHash(normalizedText: string, title: string | null): string {
  return createHash("sha256")
    .update(`${title ?? ""}\n${normalizedText}`.toLowerCase())
    .digest("hex");
}

/**
 * Stores a pasted job description with its extracted requirements. The same posting pasted
 * again by the same owner returns the stored one (with its expiry pushed back) instead of
 * extracting it again.
 */
export async function acceptJobDescription(
  input: JobDescriptionInput,
  context: Context,
): Promise<StoredJobDescription> {
  const { owner } = context;
  const normalized = normalizeJobText(input.text);
  const title = clean(input.title);
  const company = clean(input.company);
  const hash = jobDescriptionHash(normalized, title);
  const expiresAt = guestExpiry(owner);

  const existing = await jobDescriptionRepository.findDuplicate(
    owner,
    hash,
    MATCH_ENGINE_VERSION,
  );
  if (existing) {
    if (expiresAt)
      await jobDescriptionRepository.extendExpiry(owner, existing.id, expiresAt);
    logger.info("job_description.reused", {
      requestId: context.requestId,
      jobDescriptionId: existing.id,
    });
    return existing;
  }

  const extracted = extractJobRequirements(normalized, { title });
  const stored = await jobDescriptionRepository.create({
    owner,
    expiresAt,
    title: title ?? extracted.jobTitle,
    company,
    rawText: input.text.trim(),
    normalizedHash: hash,
    extracted,
    extractionSource: "rules",
    extractorVersion: MATCH_ENGINE_VERSION,
  });
  logger.info("job_description.accepted", {
    requestId: context.requestId,
    jobDescriptionId: stored.id,
    hardSkills: extracted.hardSkills.length,
    certifications: extracted.certifications.length,
    hasYears: extracted.yearsExperience.min !== null,
    hasTitle: extracted.jobTitle !== null,
  });
  return stored;
}

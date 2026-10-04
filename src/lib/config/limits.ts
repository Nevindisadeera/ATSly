/**
 * Upload limits shared by the browser and the server — docs/PLANNING.md §23.
 * 4 MB stays under Vercel's 4.5 MB request body limit.
 */
export const UPLOAD_LIMITS = {
  maxBytes: 4 * 1024 * 1024,
  maxPages: 10,
  extensions: ["pdf", "docx"] as const,
  mimeTypes: {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
} as const;

export type UploadExtension = (typeof UPLOAD_LIMITS.extensions)[number];

/** Value for an <input type="file" accept> attribute. */
export const UPLOAD_ACCEPT = [
  ".pdf",
  ".docx",
  UPLOAD_LIMITS.mimeTypes.pdf,
  UPLOAD_LIMITS.mimeTypes.docx,
].join(",");

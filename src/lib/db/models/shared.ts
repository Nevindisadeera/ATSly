import { Schema } from "mongoose";

/** Embedded owner, stored on every user-data document. */
export const OwnerSchema = new Schema(
  {
    type: { type: String, enum: ["guest", "user"], required: true },
    id: { type: String, required: true },
  },
  { _id: false },
);

/** Shared options: createdAt/updatedAt, no __v, unknown fields rejected. */
export const BASE_OPTIONS = {
  timestamps: true,
  versionKey: false,
  strict: "throw",
  minimize: false,
} as const;

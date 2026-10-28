import { model, models, Schema, type Model, type Types } from "mongoose";

import { BASE_OPTIONS } from "./shared";

/**
 * users — docs/PLANNING.md §16.1. Auth.js runs with JWT sessions and no database adapter,
 * so this collection belongs to the app alone. A password hash is absent for accounts that
 * only sign in with Google.
 */
const ProviderSchema = new Schema(
  {
    provider: { type: String, enum: ["google"], required: true },
    providerAccountId: { type: String, required: true },
  },
  { _id: false },
);

const UserSchema = new Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    image: { type: String, maxlength: 500 },
    passwordHash: { type: String },
    providers: { type: [ProviderSchema], default: [] },
    emailVerified: { type: Date },
    plan: { type: String, enum: ["free"], default: "free" },
    lastLoginAt: { type: Date },
  },
  { ...BASE_OPTIONS, collection: "users" },
);

UserSchema.index({ email: 1 }, { unique: true });

export type UserDocument = {
  _id: Types.ObjectId;
  email: string;
  name: string;
  image?: string | null;
  passwordHash?: string | null;
  providers: { provider: "google"; providerAccountId: string }[];
  emailVerified?: Date | null;
  plan: "free";
  lastLoginAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/** Reuses the compiled model across hot reloads. */
export const UserModel: Model<UserDocument> =
  (models.User as Model<UserDocument> | undefined) ??
  model<UserDocument>("User", UserSchema, "users");

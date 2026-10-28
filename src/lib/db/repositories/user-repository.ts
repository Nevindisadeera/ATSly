import "server-only";

import { UserModel, type UserDocument } from "../models/user";
import { withDb } from "../with-db";

/** An account as the application sees it. The password hash never leaves the server. */
export type StoredUser = {
  id: string;
  email: string;
  name: string;
  image: string | null;
  passwordHash: string | null;
  providers: { provider: "google"; providerAccountId: string }[];
  emailVerified: Date | null;
  createdAt: Date;
};

const OBJECT_ID = /^[0-9a-f]{24}$/i;
const DUPLICATE_KEY = 11000;

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export function isDuplicateKeyError(error: unknown): boolean {
  return (error as { code?: number } | null)?.code === DUPLICATE_KEY;
}

function toStored(doc: UserDocument): StoredUser {
  return {
    id: String(doc._id),
    email: doc.email,
    name: doc.name,
    image: doc.image ?? null,
    passwordHash: doc.passwordHash ?? null,
    providers: (doc.providers ?? []).map((p) => ({
      provider: p.provider,
      providerAccountId: p.providerAccountId,
    })),
    emailVerified: doc.emailVerified ?? null,
    createdAt: doc.createdAt,
  };
}

export const userRepository = {
  /** Throws a duplicate-key error (see isDuplicateKeyError) when the email is taken. */
  create(data: {
    email: string;
    name: string;
    passwordHash?: string;
    image?: string;
    emailVerified?: Date;
    providers?: StoredUser["providers"];
  }): Promise<StoredUser> {
    return withDb(async () => {
      const doc = await UserModel.create({ ...data, email: normalizeEmail(data.email) });
      return toStored(doc.toObject() as UserDocument);
    });
  },

  findByEmail(email: string): Promise<StoredUser | null> {
    return withDb(async () => {
      const doc = await UserModel.findOne({
        email: normalizeEmail(email),
      }).lean<UserDocument>();
      return doc ? toStored(doc) : null;
    });
  },

  findById(id: string): Promise<StoredUser | null> {
    if (!OBJECT_ID.test(id)) return Promise.resolve(null);
    return withDb(async () => {
      const doc = await UserModel.findById(id).lean<UserDocument>();
      return doc ? toStored(doc) : null;
    });
  },

  /**
   * Signs in a Google account: links it to the account with the same (verified) email, or
   * creates one. Returns the account.
   */
  upsertGoogle(profile: {
    email: string;
    name: string;
    image?: string;
    providerAccountId: string;
  }): Promise<StoredUser> {
    return withDb(async () => {
      const email = normalizeEmail(profile.email);
      const now = new Date();
      const doc = await UserModel.findOneAndUpdate(
        { email },
        {
          $setOnInsert: { email, name: profile.name, plan: "free" },
          $set: {
            lastLoginAt: now,
            emailVerified: now,
            ...(profile.image ? { image: profile.image } : {}),
          },
          $addToSet: {
            providers: {
              provider: "google",
              providerAccountId: profile.providerAccountId,
            },
          },
        },
        { upsert: true, returnDocument: "after", lean: true },
      );
      return toStored(doc as UserDocument);
    });
  },

  touchLogin(id: string): Promise<void> {
    return withDb(async () => {
      await UserModel.updateOne({ _id: id }, { $set: { lastLoginAt: new Date() } });
    });
  },
};

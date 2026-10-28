import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  /** The session's user always carries the app's account id. */
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

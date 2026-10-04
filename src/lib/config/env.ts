import "server-only";

import { parseEnv } from "./env-schema";

/** Validated server environment. Importing this module fails fast when a variable is invalid. */
export const env = parseEnv(process.env);

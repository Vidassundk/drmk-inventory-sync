import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.ts";

export * from "./schema.ts";
// Re-exported so every app uses this copy of drizzle-orm; a second copy breaks its types.
export { and, asc, count, desc, eq, gte, inArray, isNull, lte, ne, or, sql, type SQLWrapper } from "drizzle-orm";
export { schema };

export type Db = ReturnType<typeof createDb>["db"];

/** Server-only. Never import this from client components. */
export function createDb(url = process.env.DATABASE_URL, options: postgres.Options<{}> = {}) {
  if (!url) throw new Error("Missing DATABASE_URL (set it in .env at the repo root)");
  const client = postgres(url, { max: 5, ...options });
  return { db: drizzle(client, { schema }), client };
}

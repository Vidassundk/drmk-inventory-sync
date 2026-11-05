import { cache } from "react";
import { after } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@deremika/db";

/** One client per request: Workers can't share a connection between requests. Hyperdrive does the pooling. */
export const getDb = cache(() => {
  const { env } = getCloudflareContext();
  const { db, client } = createDb(env.HYPERDRIVE.connectionString, { fetch_types: false });
  after(() => client.end());
  return db;
});

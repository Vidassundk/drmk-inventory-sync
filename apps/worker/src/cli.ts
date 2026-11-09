// Usage: node src/cli.ts <rrr:full | rrr:incremental | rrr:cars [all] | images:rehost [limit]>
import { createDb, type Db } from "@drmk/db";
import { rrrClientFromEnv } from "@drmk/rrr-client";
import { rehostImages } from "./images/rehost.ts";
import { syncRrrCars } from "./rrr/cars.ts";
import { syncRrrFull, syncRrrIncremental } from "./rrr/sync.ts";
import { r2FromEnv } from "./storage/r2.ts";

const arg = process.argv[3];

const jobs = {
  "rrr:full": (db: Db) => syncRrrFull(db, rrrClientFromEnv()),
  "rrr:incremental": (db: Db) => syncRrrIncremental(db, rrrClientFromEnv()),
  "rrr:cars": (db: Db) => syncRrrCars(db, rrrClientFromEnv(), { all: arg === "all" }),
  "images:rehost": (db: Db) => rehostImages(db, r2FromEnv(), { limit: arg ? Number(arg) : undefined }),
};

const name = process.argv[2] as keyof typeof jobs;
const job = jobs[name];
if (!job) {
  console.error(`Unknown job "${process.argv[2]}". Jobs: ${Object.keys(jobs).join(", ")}`);
  process.exit(2);
}

const { db, client } = createDb();
try {
  await job(db);
} catch (err) {
  console.error(`${name} failed:`, err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await client.end({ timeout: 5 });
}

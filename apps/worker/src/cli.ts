// Usage: node src/cli.ts <rrr:full | rrr:incremental>
import { createDb } from "@deremika/db";
import { rrrClientFromEnv } from "@deremika/rrr-client";
import { syncRrrFull, syncRrrIncremental } from "./rrr/sync.ts";

const jobs = {
  "rrr:full": syncRrrFull,
  "rrr:incremental": syncRrrIncremental,
};

const name = process.argv[2] as keyof typeof jobs;
const job = jobs[name];
if (!job) {
  console.error(`Unknown job "${process.argv[2]}". Jobs: ${Object.keys(jobs).join(", ")}`);
  process.exit(2);
}

const { db, client } = createDb();
try {
  await job(db, rrrClientFromEnv());
} catch (err) {
  console.error(`${name} failed:`, err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await client.end({ timeout: 5 });
}

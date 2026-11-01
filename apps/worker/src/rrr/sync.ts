import { and, desc, eq, inArray, isNotNull, isNull, ne, or } from "drizzle-orm";
import { partListings, parts, syncRuns, type Db } from "@deremika/db";
import type { GetPartsParams, RrrClient, RrrPart } from "@deremika/rrr-client";
import { externalUpdatedAt } from "./map.ts";
import { upsertRrrPage, type PageStats } from "./upsert.ts";

const PAGE_SIZE = 100;
const PAGE_DELAY_MS = 200;
/** Re-read this much before the cursor: updated_at has 1s precision and an unknown clock. */
const CURSOR_OVERLAP_MS = 5 * 60 * 1000;
/** A full scan that sees fewer parts than this share of the API's total won't mark anything removed. */
const MIN_SEEN_RATIO = 0.95;

type Stats = Omit<PageStats, "unknownStatus"> & {
  pages: number;
  seen: number;
  removed: number;
  [unknownCode: `status_${string}`]: number;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function withRetry<T>(fn: () => Promise<T>, label: string, attempts = 4): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i >= attempts) throw err;
      const wait = 1000 * 2 ** i;
      console.warn(`${label} failed (attempt ${i}/${attempts}), retrying in ${wait}ms: ${(err as Error).message}`);
      await sleep(wait);
    }
  }
}

// RRR timestamps are naive local time; compare and shift them as naive strings.
const shiftNaive = (ts: string, ms: number) =>
  new Date(new Date(`${ts.replace(" ", "T")}Z`).getTime() + ms).toISOString().slice(0, 19).replace("T", " ");
const maxTs = (a: string | null, b: string | null) => (!a ? b : !b ? a : a > b ? a : b);

/** Runs `fn` under a session advisory lock so two syncs of the same kind never overlap. */
async function exclusive<T>(client: Db["$client"], key: string, fn: () => Promise<T>): Promise<T> {
  const conn = await client.reserve();
  try {
    const [{ locked }] = await conn`select pg_try_advisory_lock(hashtext(${key})) as locked`;
    if (!locked) throw new Error(`Another "${key}" run is in progress`);
    try {
      return await fn();
    } finally {
      await conn`select pg_advisory_unlock(hashtext(${key}))`;
    }
  } finally {
    conn.release();
  }
}

async function tracked(
  db: Db,
  kind: "full" | "incremental",
  fn: (runId: number, stats: Stats) => Promise<string | null>,
) {
  const [run] = await db.insert(syncRuns).values({ channelId: "rrr", kind }).returning({ id: syncRuns.id });
  const stats: Stats = { pages: 0, seen: 0, inserted: 0, updated: 0, unchanged: 0, removed: 0 };
  const started = Date.now();
  try {
    const cursor = await fn(run.id, stats);
    await db
      .update(syncRuns)
      .set({ status: "succeeded", cursor, stats, finishedAt: new Date() })
      .where(eq(syncRuns.id, run.id));
    console.log(`rrr:${kind} run ${run.id} succeeded in ${Math.round((Date.now() - started) / 1000)}s`, stats);
    return stats;
  } catch (err) {
    await db
      .update(syncRuns)
      .set({ status: "failed", stats, error: String((err as Error).stack ?? err), finishedAt: new Date() })
      .where(eq(syncRuns.id, run.id));
    throw err;
  }
}

async function fetchPage(rrr: RrrClient, page: number, sort: GetPartsParams["sort"]) {
  const result = await withRetry(() => rrr.getParts({ page, limit: PAGE_SIZE, sort }), `RRR page ${page}`);
  await sleep(PAGE_DELAY_MS);
  return result;
}

/** Starts fetching a page now; errors surface when awaited, not as unhandled rejections. */
function prefetchPage(...args: Parameters<typeof fetchPage>) {
  const promise = fetchPage(...args);
  promise.catch(() => {});
  return promise;
}

function addStats(stats: Stats, page: PageStats, seen: number) {
  stats.pages++;
  stats.seen += seen;
  stats.inserted += page.inserted;
  stats.updated += page.updated;
  stats.unchanged += page.unchanged;
  for (const [code, n] of Object.entries(page.unknownStatus))
    stats[`status_${code}`] = (stats[`status_${code}`] ?? 0) + n;
}

/**
 * Walks every RRR part by id, upserts it, then marks listings this run never saw
 * as removed (RRR hard-deletes parts without any other signal). Paging can shift
 * if RRR deletes parts mid-walk and skip one; the next full scan revives it.
 */
export function syncRrrFull(db: Db, rrr: RrrClient) {
  return exclusive(db.$client, "sync:rrr", () =>
    tracked(db, "full", async (runId, stats) => {
      let total = 0;
      let cursor: string | null = null;
      // Fetch page N+1 while page N is written; RRR (2-3s/page) dominates the run time.
      let next = prefetchPage(rrr, 1, { id: "asc" });
      for (let page = 1; ; page++) {
        const { parts: batch, pagination } = await next;
        total = Math.max(total, pagination.total_count);
        if (batch.length === 0) break;
        const more = page * PAGE_SIZE < pagination.total_count;
        if (more) next = prefetchPage(rrr, page + 1, { id: "asc" });
        addStats(stats, await upsertRrrPage(db, runId, batch), batch.length);
        for (const p of batch) cursor = maxTs(cursor, externalUpdatedAt(p));
        if (page % 20 === 0) console.log(`  page ${page}: ${stats.seen}/${total}`);
        if (!more) break;
      }

      if (stats.seen < total * MIN_SEEN_RATIO) {
        throw new Error(`Saw ${stats.seen} of ${total} parts; refusing to mark anything removed`);
      }
      const removed = await db
        .update(partListings)
        .set({ removedAt: new Date() })
        .where(
          and(
            eq(partListings.channelId, "rrr"),
            isNull(partListings.removedAt),
            or(isNull(partListings.lastSeenRunId), ne(partListings.lastSeenRunId, runId)),
          ),
        )
        .returning({ partId: partListings.partId });
      if (removed.length) {
        await db
          .update(parts)
          .set({ deletedAt: new Date() })
          .where(
            inArray(
              parts.id,
              removed.map((r) => r.partId),
            ),
          );
      }
      stats.removed = removed.length;
      return cursor;
    }),
  );
}

/** Upserts parts whose RRR updated_at is at or after the last cursor (minus an overlap). */
export function syncRrrIncremental(db: Db, rrr: RrrClient) {
  return exclusive(db.$client, "sync:rrr", () =>
    tracked(db, "incremental", async (runId, stats) => {
      const [last] = await db
        .select({ cursor: syncRuns.cursor })
        .from(syncRuns)
        .where(and(eq(syncRuns.channelId, "rrr"), eq(syncRuns.status, "succeeded"), isNotNull(syncRuns.cursor)))
        .orderBy(desc(syncRuns.finishedAt))
        .limit(1);
      if (!last?.cursor) throw new Error("No previous cursor; run rrr:full first");

      const since = shiftNaive(last.cursor, -CURSOR_OVERLAP_MS);
      let cursor: string | null = last.cursor;
      for (let page = 1; ; page++) {
        const { parts: batch } = await fetchPage(rrr, page, { updated_at: "desc" });
        const fresh = batch.filter((p: RrrPart) => (externalUpdatedAt(p) ?? "") >= since);
        if (fresh.length) addStats(stats, await upsertRrrPage(db, runId, fresh), fresh.length);
        for (const p of fresh) cursor = maxTs(cursor, externalUpdatedAt(p));
        if (fresh.length < batch.length || batch.length < PAGE_SIZE) break;
      }
      console.log(`  since ${since}`);
      return cursor;
    }),
  );
}

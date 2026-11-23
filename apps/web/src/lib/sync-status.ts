import { and, count, desc, eq, images, isNull, partImages, parts, rrrCars, sql, syncRuns } from "@drmk/db";
import { getDb } from "./db";
import { requireAdmin } from "./session";

/** How long the scheduled jobs may go quiet before the page warns. They run every 15 minutes, nightly and hourly. */
const LATE_MS = { incremental: 30 * 60_000, full: 26 * 60 * 60_000, photos: 2 * 60 * 60_000 };

export type Health = "ok" | "warn" | "bad";

const runColumns = {
  id: syncRuns.id,
  kind: syncRuns.kind,
  status: syncRuns.status,
  stats: syncRuns.stats,
  error: syncRuns.error,
  startedAt: syncRuns.startedAt,
  finishedAt: syncRuns.finishedAt,
};

export type SyncRun = {
  id: number;
  kind: "full" | "incremental";
  status: "running" | "succeeded" | "failed";
  stats: Record<string, number>;
  error: string | null;
  startedAt: Date;
  finishedAt: Date | null;
};

const ageMs = (date: Date | null | undefined) => (date ? Date.now() - date.getTime() : Infinity);

function runHealth(run: SyncRun | undefined, lateMs: number): Health {
  if (!run || run.status === "failed") return "bad";
  // A full sync that saw nothing means RRR stopped answering with parts, as when the API login changed.
  if (run.kind === "full" && run.stats.seen === 0) return "bad";
  return ageMs(run.finishedAt) > lateMs ? "warn" : "ok";
}

/**
 * Everything the sync page shows, read from our own database only: the jobs record their runs and progress there, so
 * the page never calls RRR or GitHub. Admins only.
 */
export async function getSyncStatus() {
  await requireAdmin();
  const db = getDb();
  const lastOf = (kind: "full" | "incremental") =>
    db
      .select(runColumns)
      .from(syncRuns)
      .where(and(eq(syncRuns.kind, kind), sql`${syncRuns.status} <> 'running'`))
      .orderBy(desc(syncRuns.startedAt))
      .limit(1);

  const [running, [lastIncremental], [lastFull], [rrrTotal], [partCounts], imageCounts, [covers], [cars], recent] =
    await Promise.all([
      db.select(runColumns).from(syncRuns).where(eq(syncRuns.status, "running")).orderBy(desc(syncRuns.startedAt)),
      lastOf("incremental"),
      lastOf("full"),
      // RRR's own count of parts, from the latest full sync that recorded it (a running one counts too).
      db
        .select({ total: sql<number | null>`(${syncRuns.stats}->>'total')::int` })
        .from(syncRuns)
        .where(and(eq(syncRuns.kind, "full"), sql`${syncRuns.stats} ? 'total'`))
        .orderBy(desc(syncRuns.startedAt))
        .limit(1),
      db
        .select({
          live: sql<number>`count(*) filter (where ${parts.deletedAt} is null)::int`,
          removed: sql<number>`count(*) filter (where ${parts.deletedAt} is not null)::int`,
          inStock: sql<number>`count(*) filter (where ${parts.deletedAt} is null and ${parts.status} = 'in_stock')::int`,
        })
        .from(parts),
      db
        .select({
          status: images.status,
          count: count(),
          lastStoredAt: sql<Date | null>`max(${images.storedAt})`,
          storedToday: sql<number>`count(*) filter (where ${images.storedAt} > now() - interval '24 hours')::int`,
        })
        .from(images)
        .groupBy(images.status),
      // Cover photos of parts in stock: the photo job copies these first, since they're what lists show.
      db
        .select({
          total: count(),
          stored: sql<number>`count(*) filter (where ${images.status} = 'stored')::int`,
        })
        .from(partImages)
        .innerJoin(parts, eq(parts.id, partImages.partId))
        .innerJoin(images, eq(images.id, partImages.imageId))
        .where(and(eq(partImages.position, 0), eq(parts.status, "in_stock"), isNull(parts.deletedAt))),
      db.select({ total: count(), lastChangedAt: sql<Date | null>`max(${rrrCars.updatedAt})` }).from(rrrCars),
      db.select(runColumns).from(syncRuns).orderBy(desc(syncRuns.startedAt)).limit(20),
    ]);

  const photos = { stored: 0, pending: 0, failed: 0, storedToday: 0, lastStoredAt: null as Date | null };
  for (const row of imageCounts) {
    photos[row.status] = row.count;
    photos.storedToday += row.storedToday;
    if (row.lastStoredAt) photos.lastStoredAt = new Date(row.lastStoredAt);
  }
  const photoTotal = photos.stored + photos.pending + photos.failed;
  // At the last day's pace, when the waiting photos will all be copied.
  const photosDoneAt =
    photos.pending > 0 && photos.storedToday > 0
      ? new Date(Date.now() + (photos.pending / photos.storedToday) * 24 * 60 * 60_000)
      : null;

  return {
    running: running as SyncRun[],
    parts: { ...partCounts, rrrTotal: rrrTotal?.total ?? null },
    photos: { ...photos, total: photoTotal, doneAt: photosDoneAt },
    covers,
    cars: { total: cars.total, lastChangedAt: cars.lastChangedAt ? new Date(cars.lastChangedAt) : null },
    health: {
      incremental: {
        run: lastIncremental as SyncRun | undefined,
        health: runHealth(lastIncremental as SyncRun, LATE_MS.incremental),
      },
      full: { run: lastFull as SyncRun | undefined, health: runHealth(lastFull as SyncRun, LATE_MS.full) },
      photos: {
        lastStoredAt: photos.lastStoredAt,
        health: (photos.failed > 0 || (photos.pending > 0 && ageMs(photos.lastStoredAt) > LATE_MS.photos)
          ? "warn"
          : "ok") as Health,
      },
    },
    recent: recent as SyncRun[],
  };
}

export type SyncStatus = Awaited<ReturnType<typeof getSyncStatus>>;

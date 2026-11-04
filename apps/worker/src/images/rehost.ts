import { createHash } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { imageSize } from "image-size";
import { images, partImages, parts, type Db } from "@deremika/db";
import { exclusive } from "../lock.ts";
import type { R2 } from "../storage/r2.ts";

const BATCH_SIZE = 200;
const CONCURRENCY = 6;
const MAX_ATTEMPTS = 5;
const FETCH_TIMEOUT_MS = 30_000;
// Ovoko allows about 100 image requests per hour per IP, however they are spaced, then answers
// with a 429 and an hour-long Retry-After that also blocks everyone else on our network.
// By default spread just under that across the hour, and slow down further if we still trip it.
// Short scheduled runs (one batch of ~95 per hour) set REHOST_INTERVAL_MS lower instead.
const REQUEST_INTERVAL_MS = Number(process.env.REHOST_INTERVAL_MS) || 37_000;
// Scheduled runs stop instead of sitting out a long block; the next run picks up where this one stopped.
const MAX_PAUSE_MS = Number(process.env.REHOST_MAX_PAUSE_MS) || Infinity;
const BACKOFF_SLOWDOWN = 1.5;
const DEFAULT_BACKOFF_MS = 60_000;

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

type Pending = { id: string; sourceUrl: string; attempts: number };
type Stats = { stored: number; reused: number; retrying: number; failed: number; rateLimited: number };

/** Spaces requests evenly across all workers and holds them all while the source asks us to back off. */
class Pacer {
  private next = 0;
  private resumeAt = 0;
  private intervalMs: number;

  constructor(intervalMs: number) {
    this.intervalMs = intervalMs;
  }

  async wait() {
    for (;;) {
      const now = Date.now();
      const at = Math.max(now, this.next, this.resumeAt);
      this.next = at + this.intervalMs;
      if (at > now) await sleep(at - now);
      // A pause may have started while we slept.
      if (Date.now() >= this.resumeAt) return;
    }
  }

  /** Holds all requests for `ms` and spaces them further apart afterwards. */
  backOff(ms: number) {
    this.resumeAt = Math.max(this.resumeAt, Date.now() + ms);
    this.intervalMs *= BACKOFF_SLOWDOWN;
  }

  get interval() {
    return this.intervalMs;
  }
}

class RateLimited extends Error {
  readonly retryAfterMs: number;

  constructor(retryAfterMs: number) {
    super("HTTP 429");
    this.retryAfterMs = retryAfterMs;
  }
}

function retryAfterMs(res: Response) {
  const header = res.headers.get("retry-after");
  const seconds = Number(header);
  if (header && Number.isFinite(seconds)) return seconds * 1000;
  const date = header ? Date.parse(header) : NaN;
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : DEFAULT_BACKOFF_MS;
}

/**
 * Downloads one source image and stores it in R2 under its content hash.
 * Throws RateLimited without touching the row, so a 429 never uses up an attempt.
 */
async function rehostOne(db: Db, r2: R2, image: Pending, stats: Stats) {
  try {
    const res = await fetch(image.sourceUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (res.status === 429) {
      await res.body?.cancel();
      throw new RateLimited(retryAfterMs(res));
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    const ext = EXTENSIONS[contentType];
    if (!ext) throw new Error(`Not an image: ${contentType || "no content-type"}`);

    const body = new Uint8Array(await res.arrayBuffer());
    const sha256 = createHash("sha256").update(body).digest("hex");
    const storageKey = `parts/${sha256.slice(0, 2)}/${sha256}.${ext}`;
    const { width, height } = imageSize(body);

    // Identical files from different URLs share one object.
    if (await r2.exists(storageKey)) stats.reused++;
    else await r2.put(storageKey, body, contentType);

    await db
      .update(images)
      .set({
        status: "stored",
        sha256,
        storageKey,
        contentType,
        bytes: body.byteLength,
        width: width ?? null,
        height: height ?? null,
        attempts: image.attempts + 1,
        lastError: null,
        storedAt: new Date(),
      })
      .where(eq(images.id, image.id));
    stats.stored++;
  } catch (err) {
    if (err instanceof RateLimited) throw err;
    const attempts = image.attempts + 1;
    const failed = attempts >= MAX_ATTEMPTS;
    await db
      .update(images)
      .set({ attempts, lastError: String((err as Error).message ?? err), status: failed ? "failed" : "pending" })
      .where(eq(images.id, image.id));
    if (failed) stats.failed++;
    else stats.retrying++;
  }
}

/**
 * Rehosts pending images to R2, oldest first, until none are left or `limit`
 * have been attempted. Failures stay pending until MAX_ATTEMPTS, then "failed";
 * rate limiting pauses the whole run instead of counting as a failure.
 * Safe to stop and restart at any point.
 */
export function rehostImages(db: Db, r2: R2, { limit = Infinity } = {}) {
  return exclusive(db.$client, "images:rehost", () => rehost(db, r2, limit));
}

async function rehost(db: Db, r2: R2, limit: number) {
  const stats: Stats = { stored: 0, reused: 0, retrying: 0, failed: 0, rateLimited: 0 };
  const pacer = new Pacer(REQUEST_INTERVAL_MS);
  const started = Date.now();
  let attempted = 0;
  let stopped = false;

  // Images of parts still for sale go first; sold parts' photos matter least.
  const inStock = sql<boolean>`exists (
    select 1 from ${partImages} join ${parts} on ${parts.id} = ${partImages.partId}
    where ${partImages.imageId} = ${images.id} and ${parts.status} = 'in_stock' and ${parts.deletedAt} is null
  )`;

  while (attempted < limit && !stopped) {
    // Failed images stay pending with attempts+1, so they sort after fresh ones and stop at MAX_ATTEMPTS.
    const batch = await db
      .select({ id: images.id, sourceUrl: images.sourceUrl, attempts: images.attempts })
      .from(images)
      .where(and(eq(images.status, "pending"), sql`${images.attempts} < ${MAX_ATTEMPTS}`))
      .orderBy(asc(images.attempts), desc(inStock), asc(images.createdAt))
      .limit(Math.min(BATCH_SIZE, limit - attempted));
    if (batch.length === 0) break;

    // Simple worker pool: CONCURRENCY downloads in flight at a time, one started per request interval.
    const queue = [...batch];
    await Promise.all(
      Array.from({ length: CONCURRENCY }, async () => {
        for (let image = queue.shift(); image; image = queue.shift()) {
          await pacer.wait();
          try {
            await rehostOne(db, r2, image, stats);
          } catch (err) {
            if (!(err instanceof RateLimited)) throw err;
            stats.rateLimited++;
            if (err.retryAfterMs > MAX_PAUSE_MS) {
              if (!stopped) console.log(`  rate limited for ${Math.round(err.retryAfterMs / 1000)}s, stopping`);
              stopped = true;
              queue.length = 0;
              break;
            }
            pacer.backOff(err.retryAfterMs);
            queue.unshift(image);
            console.log(
              `  rate limited, pausing ${Math.round(err.retryAfterMs / 1000)}s, then 1 request per ${(pacer.interval / 1000).toFixed(1)}s`,
            );
          }
        }
      }),
    );
    attempted += batch.length - queue.length;

    const rate = attempted / ((Date.now() - started) / 1000);
    console.log(`  ${attempted} attempted (${rate.toFixed(1)}/s)`, stats);
  }

  console.log(`images:rehost done in ${Math.round((Date.now() - started) / 1000)}s`, stats);
  return stats;
}

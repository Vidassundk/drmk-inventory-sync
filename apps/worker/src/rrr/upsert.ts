import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { images, partImages, partListings, parts, type Db } from "@drmk/db";
import type { RrrPart } from "@drmk/rrr-client";
import { contentHash, externalUpdatedAt, galleryUrls, partValues, stablePayload } from "./map.ts";

export type PageStats = { inserted: number; updated: number; unchanged: number; unknownStatus: Record<string, number> };

/**
 * Upserts one page of RRR parts in a single transaction. Unchanged parts (same
 * raw payload hash) only get their last-seen markers bumped.
 */
export async function upsertRrrPage(db: Db, runId: number, page: RrrPart[]): Promise<PageStats> {
  const stats: PageStats = { inserted: 0, updated: 0, unchanged: 0, unknownStatus: {} };
  // A part can repeat across pages when sorting by updated_at; keep the last copy.
  const byId = new Map(page.map((p) => [p.id, p]));
  if (byId.size === 0) return stats;

  await db.transaction(async (tx) => {
    const existing = await tx
      .select({
        listingId: partListings.id,
        partId: partListings.partId,
        externalId: partListings.externalId,
        contentHash: partListings.contentHash,
      })
      .from(partListings)
      .where(and(eq(partListings.channelId, "rrr"), inArray(partListings.externalId, [...byId.keys()])));
    const existingById = new Map(existing.map((e) => [e.externalId, e]));

    const now = new Date();
    const unchangedListingIds: string[] = [];
    const unchangedPartIds: string[] = [];
    const galleries = new Map<string, string[]>(); // partId -> urls, for new or changed parts
    const newParts: (typeof parts.$inferInsert)[] = [];
    const newListings: (typeof partListings.$inferInsert)[] = [];

    for (const p of byId.values()) {
      if (partValues(p).status === "unknown") stats.unknownStatus[p.status] = (stats.unknownStatus[p.status] ?? 0) + 1;
      const hash = contentHash(p);
      const found = existingById.get(p.id);
      const listing = {
        externalUpdatedAt: externalUpdatedAt(p),
        raw: stablePayload(p),
        contentHash: hash,
        lastSeenRunId: runId,
        lastSeenAt: now,
        removedAt: null,
      };

      if (!found) {
        const partId = randomUUID();
        newParts.push({ id: partId, ...partValues(p) });
        newListings.push({ partId, channelId: "rrr", externalId: p.id, ...listing });
        galleries.set(partId, galleryUrls(p));
        stats.inserted++;
      } else if (found.contentHash !== hash) {
        await tx
          .update(parts)
          .set({ ...partValues(p), deletedAt: null })
          .where(eq(parts.id, found.partId));
        await tx.update(partListings).set(listing).where(eq(partListings.id, found.listingId));
        galleries.set(found.partId, galleryUrls(p));
        stats.updated++;
      } else {
        unchangedListingIds.push(found.listingId);
        unchangedPartIds.push(found.partId);
        stats.unchanged++;
      }
    }

    if (newParts.length) {
      await tx.insert(parts).values(newParts);
      await tx.insert(partListings).values(newListings);
    }

    if (unchangedListingIds.length) {
      await tx
        .update(partListings)
        .set({ lastSeenRunId: runId, lastSeenAt: now, removedAt: null })
        .where(inArray(partListings.id, unchangedListingIds));
      // A part a previous full scan missed (e.g. paging shifted) comes back to life.
      await tx
        .update(parts)
        .set({ deletedAt: null })
        .where(and(inArray(parts.id, unchangedPartIds), isNotNull(parts.deletedAt)));
    }

    if (galleries.size) await replaceGalleries(tx, galleries);
  });

  return stats;
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Points each part at its current photo URLs. Image rows start "pending" until rehosted. */
async function replaceGalleries(tx: Tx, galleries: Map<string, string[]>) {
  const urls = [...new Set([...galleries.values()].flat())];
  if (urls.length) {
    await tx
      .insert(images)
      .values(urls.map((sourceUrl) => ({ sourceUrl })))
      .onConflictDoNothing({ target: images.sourceUrl });
  }
  const imageIds = urls.length
    ? new Map(
        (
          await tx
            .select({ id: images.id, sourceUrl: images.sourceUrl })
            .from(images)
            .where(inArray(images.sourceUrl, urls))
        ).map((r) => [r.sourceUrl, r.id]),
      )
    : new Map<string, string>();

  await tx.delete(partImages).where(inArray(partImages.partId, [...galleries.keys()]));
  const rows = [...galleries].flatMap(([partId, partUrls]) =>
    partUrls.map((url, position) => ({ partId, imageId: imageIds.get(url)!, position })),
  );
  if (rows.length) await tx.insert(partImages).values(rows);
}

import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  and,
  count,
  eq,
  images,
  inArray,
  isNull,
  or,
  partImages,
  partListings,
  parts,
  partSearchText,
  rrrCarModels,
  rrrCars,
  sql,
} from "@deremika/db";
import { getDb } from "./db";
import type { PartsQuery, PartTab } from "./parts-query";

const MAX_SEARCH_TERMS = 5;

/** Our R2 copy if the photo has been rehosted, otherwise the original on Ovoko. */
export function imageUrl(image: { storageKey: string | null; sourceUrl: string | null }) {
  if (image.storageKey) return `${getCloudflareContext().env.R2_PUBLIC_BASE_URL}/${image.storageKey}`;
  return image.sourceUrl;
}

function tabFilter(tab: PartTab) {
  const inStock = inArray(parts.status, ["in_stock", "reserved"]);
  switch (tab) {
    case "stock":
      return inStock;
    case "reserved":
      return eq(parts.status, "reserved");
    case "sold":
      return eq(parts.status, "sold");
    case "noPrice":
      return and(inStock, or(isNull(parts.price), eq(parts.price, "0")));
    case "all":
      return undefined;
  }
}

/** One search word: found in the part's name or codes, or in its car's brand and model. */
function termFilter(term: string) {
  const pattern = `%${term.replace(/[\\%_]/g, "\\$&")}%`;
  const carIds = sql`(
    select ${rrrCars.id} from ${rrrCars}
    join ${rrrCarModels} on ${rrrCarModels.id} = ${rrrCars.modelId}
    where lower(${rrrCarModels.brand} || ' ' || ${rrrCarModels.name}) like ${pattern}
  )`;
  return or(sql`${partSearchText(parts)} like ${pattern}`, sql`${parts.rrrCarId} in ${carIds}`);
}

/** Every word must match, so "volvo v50 blokas" works. A whole-number search also matches the RRR ID. */
function searchFilter(q: string) {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, MAX_SEARCH_TERMS);
  if (terms.length === 0) return undefined;

  const text = and(...terms.map(termFilter));
  if (!/^\d+$/.test(q)) return text;

  const byRrrId = sql`${parts.id} in (
    select ${partListings.partId} from ${partListings}
    where ${partListings.channelId} = 'rrr' and ${partListings.externalId} = ${q}
  )`;
  return or(text, byRrrId);
}

export async function listParts({ tab, q, page, pageSize }: PartsQuery) {
  const db = getDb();
  const where = and(isNull(parts.deletedAt), tabFilter(tab), searchFilter(q));

  // Must match the parts_listed_idx order, or Postgres sorts the whole table for every page.
  const newestFirst = [sql`${parts.listedAt} desc nulls last`, sql`${parts.id} desc nulls last`];

  // Find the page's ids from the index alone, then join only those rows. Joining first would
  // also join every row OFFSET skips, which made deep pages take seconds.
  const pageIds = db
    .select({ id: parts.id })
    .from(parts)
    .where(where)
    .orderBy(...newestFirst)
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .as("page_ids");

  // Rows and total run at the same time. Only the columns the table shows are read, never the raw payload.
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: parts.id,
        rrrId: partListings.externalId,
        name: parts.name,
        manufacturerCode: parts.manufacturerCode,
        visibleCode: parts.visibleCode,
        otherCode: parts.otherCode,
        price: parts.price,
        currency: parts.currency,
        status: parts.status,
        rrrCarId: parts.rrrCarId,
        carBrand: rrrCarModels.brand,
        carModel: rrrCarModels.name,
        carYearStart: rrrCarModels.yearStart,
        carYearEnd: rrrCarModels.yearEnd,
        carYear: rrrCars.year,
        carBodyType: rrrCars.bodyType,
        carFuel: rrrCars.fuel,
        carPowerKw: rrrCars.powerKw,
        carEngineCc: rrrCars.engineCc,
        carColor: rrrCars.color,
        carWheelDrive: rrrCars.wheelDrive,
        listedAt: parts.listedAt,
        storageKey: images.storageKey,
        sourceUrl: images.sourceUrl,
        photoCount: sql<number>`(select count(*)::int from ${partImages} where ${partImages.partId} = ${parts.id})`,
      })
      .from(pageIds)
      .innerJoin(parts, eq(parts.id, pageIds.id))
      .leftJoin(partListings, and(eq(partListings.partId, parts.id), eq(partListings.channelId, "rrr")))
      .leftJoin(partImages, and(eq(partImages.partId, parts.id), eq(partImages.position, 0)))
      .leftJoin(images, eq(images.id, partImages.imageId))
      .leftJoin(rrrCars, eq(rrrCars.id, parts.rrrCarId))
      .leftJoin(rrrCarModels, eq(rrrCarModels.id, rrrCars.modelId))
      .orderBy(...newestFirst),
    db.select({ total: count() }).from(parts).where(where),
  ]);

  return {
    total,
    rows: rows.map(({ storageKey, sourceUrl, ...part }) => ({
      ...part,
      coverUrl: imageUrl({ storageKey, sourceUrl }),
    })),
  };
}

export type PartRow = Awaited<ReturnType<typeof listParts>>["rows"][number];

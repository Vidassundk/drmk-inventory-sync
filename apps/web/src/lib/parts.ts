import { cache } from "react";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  and,
  count,
  eq,
  images,
  inArray,
  isNull,
  ne,
  or,
  partImages,
  partListings,
  parts,
  partSearchText,
  rrrCarModels,
  rrrCars,
  rrrCategories,
  sql,
} from "@deremika/db";
import { getDb } from "./db";
import type { PartsQuery, PartTab } from "./parts-query";

const MAX_SEARCH_TERMS = 5;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Fields still kept only in the raw RRR payload. They move to real columns if we need to sort or filter by them. */
const rawColumns = {
  positionCode: sql<string | null>`${partListings.raw}->>'position'`,
  createdByUser: sql<string | null>`${partListings.raw}->>'mechanic'`,
  reservedByUser: sql<string | null>`${partListings.raw}->>'reserved_user'`,
  reservedAt: sql<string | null>`${partListings.raw}->>'reserved_date'`,
};

const carColumns = {
  rrrCarId: parts.rrrCarId,
  categoryId: parts.rrrCategoryId,
  carModelId: rrrCars.modelId,
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
};

/** Our R2 copy if the photo has been rehosted, otherwise the original on Ovoko. */
export function imageUrl(image: { storageKey: string | null; sourceUrl: string | null }) {
  if (image.storageKey) return `${getCloudflareContext().env.R2_PUBLIC_BASE_URL}/${image.storageKey}`;
  return image.sourceUrl;
}

const inStock = () => inArray(parts.status, ["in_stock", "reserved"]);

function tabFilter(tab: PartTab) {
  switch (tab) {
    case "stock":
      return inStock();
    case "reserved":
      return eq(parts.status, "reserved");
    case "sold":
      return eq(parts.status, "sold");
    case "noPrice":
      return and(inStock(), or(isNull(parts.price), eq(parts.price, "0")));
    case "all":
      return undefined;
  }
}

function similarFilter({ category, model }: Pick<PartsQuery, "category" | "model">) {
  return and(
    category ? eq(parts.rrrCategoryId, category) : undefined,
    model
      ? sql`${parts.rrrCarId} in (select ${rrrCars.id} from ${rrrCars} where ${rrrCars.modelId} = ${model})`
      : undefined,
  );
}

type StockGroup = { categoryId: number | null; carModelId: number | null };
const groupKey = ({ categoryId, carModelId }: StockGroup) =>
  categoryId && carModelId ? `${categoryId}:${carModelId}` : null;

/**
 * RRR's "Sandėlyje": how many parts are in stock with the same category and car model, and their average
 * price leaving out parts with no price. Runs for one page of rows, so it costs one small grouped query.
 */
async function stockFor(groups: StockGroup[]) {
  const pairs = new Map(
    groups.flatMap((group) => {
      const key = groupKey(group);
      return key ? [[key, group] as const] : [];
    }),
  );
  if (pairs.size === 0) return new Map<string, { count: number; averagePrice: string | null }>();

  const stats = await getDb()
    .select({
      categoryId: parts.rrrCategoryId,
      carModelId: rrrCars.modelId,
      count: count(),
      averagePrice: sql<string | null>`avg(nullif(${parts.price}, 0))`,
    })
    .from(parts)
    .innerJoin(rrrCars, eq(rrrCars.id, parts.rrrCarId))
    .where(
      and(
        inStock(),
        isNull(parts.deletedAt),
        sql`(${parts.rrrCategoryId}, ${rrrCars.modelId}) in (${sql.join(
          [...pairs.values()].map((pair) => sql`(${pair.categoryId}::int, ${pair.carModelId}::int)`),
          sql`, `,
        )})`,
      ),
    )
    .groupBy(parts.rrrCategoryId, rrrCars.modelId);

  return new Map(stats.map(({ count, averagePrice, ...group }) => [groupKey(group)!, { count, averagePrice }]));
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

export async function listParts({ tab, q, page, pageSize, category, model }: PartsQuery) {
  const db = getDb();
  const where = and(isNull(parts.deletedAt), tabFilter(tab), searchFilter(q), similarFilter({ category, model }));

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

  // Rows and total run at the same time. Only the fields the table can show are read, and the raw
  // payload is only touched for the page's own rows.
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
        quality: parts.quality,
        category: rrrCategories.name,
        notes: parts.notes,
        ...rawColumns,
        ...carColumns,
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
      .leftJoin(rrrCategories, eq(rrrCategories.id, parts.rrrCategoryId))
      .orderBy(...newestFirst),
    db.select({ total: count() }).from(parts).where(where),
  ]);

  const stock = await stockFor(rows);

  return {
    total,
    rows: rows.map(({ storageKey, sourceUrl, ...part }) => ({
      ...part,
      coverUrl: imageUrl({ storageKey, sourceUrl }),
      stock: stock.get(groupKey(part) ?? "") ?? null,
    })),
  };
}

/** The category and car model behind a "Sandėlyje" link, for the filter label above the list. */
export async function similarFilterLabel({ category, model }: Pick<PartsQuery, "category" | "model">) {
  if (!category && !model) return null;
  const db = getDb();
  const [[categoryRow], [modelRow]] = await Promise.all([
    category ? db.select({ name: rrrCategories.name }).from(rrrCategories).where(eq(rrrCategories.id, category)) : [],
    model
      ? db
          .select({ brand: rrrCarModels.brand, name: rrrCarModels.name })
          .from(rrrCarModels)
          .where(eq(rrrCarModels.id, model))
      : [],
  ]);
  return [categoryRow?.name, modelRow && `${modelRow.brand} ${modelRow.name}`].filter(Boolean).join(" · ");
}

/** Other in-stock parts counted with this one by "Sandėlyje". */
export async function listSimilarParts(part: StockGroup & { id: string }, limit: number) {
  const { categoryId, carModelId } = part;
  if (!categoryId || !carModelId) return { rows: [], total: 0 };

  const db = getDb();
  const where = and(
    inStock(),
    isNull(parts.deletedAt),
    similarFilter({ category: categoryId, model: carModelId }),
    ne(parts.id, part.id),
  );

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: parts.id,
        rrrId: partListings.externalId,
        name: parts.name,
        price: parts.price,
        currency: parts.currency,
        status: parts.status,
        carYear: rrrCars.year,
        storageKey: images.storageKey,
        sourceUrl: images.sourceUrl,
        photoCount: sql<number>`(select count(*)::int from ${partImages} where ${partImages.partId} = ${parts.id})`,
      })
      .from(parts)
      .leftJoin(partListings, and(eq(partListings.partId, parts.id), eq(partListings.channelId, "rrr")))
      .leftJoin(partImages, and(eq(partImages.partId, parts.id), eq(partImages.position, 0)))
      .leftJoin(images, eq(images.id, partImages.imageId))
      .leftJoin(rrrCars, eq(rrrCars.id, parts.rrrCarId))
      .where(where)
      .orderBy(sql`${parts.listedAt} desc nulls last`, sql`${parts.id} desc nulls last`)
      .limit(limit),
    db.select({ total: count() }).from(parts).where(where),
  ]);

  return {
    total,
    rows: rows.map(({ storageKey, sourceUrl, ...similar }) => ({
      ...similar,
      coverUrl: imageUrl({ storageKey, sourceUrl }),
    })),
  };
}

export type PartRow = Awaited<ReturnType<typeof listParts>>["rows"][number];

/** One part with everything the detail page shows. Cached so metadata and the page share a single read. */
export const getPart = cache(async (id: string) => {
  if (!UUID.test(id)) return null;
  const db = getDb();

  const [[part], photos] = await Promise.all([
    db
      .select({
        id: parts.id,
        rrrId: partListings.externalId,
        rrrUrl: sql<string | null>`${partListings.raw}->>'shop_url'`,
        name: parts.name,
        manufacturerCode: parts.manufacturerCode,
        visibleCode: parts.visibleCode,
        otherCode: parts.otherCode,
        notes: parts.notes,
        price: parts.price,
        currency: parts.currency,
        quality: parts.quality,
        status: parts.status,
        listedAt: parts.listedAt,
        deletedAt: parts.deletedAt,
        categoryPath: rrrCategories.path,
        ...rawColumns,
        ...carColumns,
      })
      .from(parts)
      .leftJoin(partListings, and(eq(partListings.partId, parts.id), eq(partListings.channelId, "rrr")))
      .leftJoin(rrrCars, eq(rrrCars.id, parts.rrrCarId))
      .leftJoin(rrrCarModels, eq(rrrCarModels.id, rrrCars.modelId))
      .leftJoin(rrrCategories, eq(rrrCategories.id, parts.rrrCategoryId))
      .where(eq(parts.id, id))
      .limit(1),
    db
      .select({ storageKey: images.storageKey, sourceUrl: images.sourceUrl })
      .from(partImages)
      .innerJoin(images, eq(images.id, partImages.imageId))
      .where(eq(partImages.partId, id))
      .orderBy(partImages.position),
  ]);

  if (!part) return null;
  return { ...part, photoUrls: photos.map(imageUrl).filter((url) => url !== null) };
});

import { cache } from "react";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import {
  and,
  count,
  desc,
  eq,
  gte,
  images,
  inArray,
  isNull,
  lte,
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
  type SQLWrapper,
} from "@deremika/db";
import { getDb } from "./db";
import type { Locale } from "./i18n";
import { getI18n } from "./i18n-server";
import { carOption, carTitle } from "./part-format";
import type { PartsQuery } from "./parts-query";

const MAX_SEARCH_TERMS = 5;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Fields still kept only in the raw RRR payload. They move to real columns if we need to sort or filter by them. */
const rawColumns = {
  positionCode: sql<string | null>`${partListings.raw}->>'position'`,
  createdByUser: sql<string | null>`${partListings.raw}->>'mechanic'`,
  reservedByUser: sql<string | null>`${partListings.raw}->>'reserved_user'`,
  reservedAt: sql<string | null>`${partListings.raw}->>'reserved_date'`,
};

/** A value in the viewer's language, falling back to Lithuanian if it has no translation. */
const inLanguage = (locale: Locale, values: Record<Locale, SQLWrapper>) =>
  sql<string | null>`coalesce(${values[locale]}, ${values.lt})`;

const categoryName = (locale: Locale) =>
  inLanguage(locale, { lt: rrrCategories.name, en: rrrCategories.nameEn, ru: rrrCategories.nameRu });

const categoryPath = (locale: Locale) =>
  inLanguage(locale, { lt: rrrCategories.path, en: rrrCategories.pathEn, ru: rrrCategories.pathRu });

/** Part names come from their category, so they translate with it. A name someone typed by hand stays as written. */
const partName = (locale: Locale) =>
  sql<string>`case when ${parts.name} = ${rrrCategories.name} then ${categoryName(locale)} else ${parts.name} end`;

const carLabel = (locale: Locale, field: string, lithuanian: SQLWrapper) =>
  sql<
    string | null
  >`coalesce(${rrrCars.translations}->${sql.raw(`'${locale}'`)}->>${sql.raw(`'${field}'`)}, ${lithuanian})`;

const carColumns = (locale: Locale) => ({
  rrrCarId: parts.rrrCarId,
  categoryId: parts.rrrCategoryId,
  carModelId: rrrCars.modelId,
  carBrand: rrrCarModels.brand,
  carModel: rrrCarModels.name,
  carYearStart: rrrCarModels.yearStart,
  carYearEnd: rrrCarModels.yearEnd,
  carYear: rrrCars.year,
  carBodyType: carLabel(locale, "bodyType", rrrCars.bodyType),
  carFuel: carLabel(locale, "fuel", rrrCars.fuel),
  carPowerKw: rrrCars.powerKw,
  carEngineCc: rrrCars.engineCc,
  carColor: carLabel(locale, "color", rrrCars.color),
  carWheelDrive: carLabel(locale, "wheelDrive", rrrCars.wheelDrive),
});

/** Our R2 copy if the photo has been rehosted, otherwise the original on Ovoko. */
export function imageUrl(image: { storageKey: string | null; sourceUrl: string | null }) {
  if (image.storageKey) return `${getCloudflareContext().env.R2_PUBLIC_BASE_URL}/${image.storageKey}`;
  return image.sourceUrl;
}

const inStock = () => inArray(parts.status, ["in_stock", "reserved"]);

function filtersFor({ statuses, priceMin, priceMax, noPrice, brand, car, qualities, code }: PartsQuery) {
  const brandCarIds = sql`(
    select ${rrrCars.id} from ${rrrCars}
    join ${rrrCarModels} on ${rrrCarModels.id} = ${rrrCars.modelId}
    where ${rrrCarModels.brand} = ${brand}
  )`;

  return and(
    statuses.length > 0 ? inArray(parts.status, statuses) : undefined,
    priceMin !== null ? gte(parts.price, String(priceMin)) : undefined,
    priceMax !== null ? lte(parts.price, String(priceMax)) : undefined,
    noPrice ? or(isNull(parts.price), eq(parts.price, "0")) : undefined,
    brand ? sql`${parts.rrrCarId} in ${brandCarIds}` : undefined,
    car ? eq(parts.rrrCarId, car) : undefined,
    qualities.length > 0 ? inArray(parts.quality, qualities) : undefined,
    // A part counts as having a code if any of its three code fields is filled in.
    code === "with"
      ? sql`coalesce(${parts.manufacturerCode}, ${parts.visibleCode}, ${parts.otherCode}) is not null`
      : undefined,
    code === "without"
      ? sql`coalesce(${parts.manufacturerCode}, ${parts.visibleCode}, ${parts.otherCode}) is null`
      : undefined,
  );
}

// RRR's own shortcut list, shown above the alphabetical brands.
const TOP_BRANDS = ["BMW", "Mercedes-Benz", "Audi", "Ford", "Renault", "Volvo", "Opel", "Volkswagen", "ZAZ"];

/**
 * One page of catalogue models matching every search word. The catalogue has thousands of models, so the
 * filter loads them as it scrolls. Brands we stock come first, A to Z, then the rest, so the list opens on
 * Audi rather than on brands like Acura that we've never had.
 */
export async function searchCarModels(q: string, brand: string | null, limit: number, offset: number) {
  const db = getDb();
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, MAX_SEARCH_TERMS);
  const stocked = db
    .selectDistinct({ brand: sql<string>`${rrrCarModels.brand}`.as("stocked_brand") })
    .from(parts)
    .innerJoin(rrrCars, eq(rrrCars.id, parts.rrrCarId))
    .innerJoin(rrrCarModels, eq(rrrCarModels.id, rrrCars.modelId))
    .where(and(inStock(), isNull(parts.deletedAt)))
    .as("stocked");

  const rows = await db
    .select({
      id: rrrCarModels.id,
      carBrand: rrrCarModels.brand,
      carModel: rrrCarModels.name,
      carYearStart: rrrCarModels.yearStart,
      carYearEnd: rrrCarModels.yearEnd,
    })
    .from(rrrCarModels)
    .leftJoin(stocked, eq(stocked.brand, rrrCarModels.brand))
    .where(
      and(
        brand ? eq(rrrCarModels.brand, brand) : undefined,
        ...terms.map(
          (term) =>
            sql`lower(${rrrCarModels.brand} || ' ' || ${rrrCarModels.name}) like ${`%${term.replace(/[\\%_]/g, "\\$&")}%`}`,
        ),
      ),
    )
    // The id comes last so the order never changes between pages, or scrolling could repeat or skip a model.
    .orderBy(
      sql`${stocked.brand} is null`,
      rrrCarModels.brand,
      rrrCarModels.name,
      rrrCarModels.yearStart,
      rrrCarModels.id,
    )
    .limit(limit)
    .offset(offset);

  return rows.map((row) => ({ id: row.id, label: carTitle(row)! }));
}

const carOptionColumns = (locale: Locale) => ({
  id: rrrCars.id,
  carBrand: rrrCarModels.brand,
  carModel: rrrCarModels.name,
  carYearStart: rrrCarModels.yearStart,
  carYearEnd: rrrCarModels.yearEnd,
  carYear: rrrCars.year,
  carBodyType: carLabel(locale, "bodyType", rrrCars.bodyType),
  carFuel: carLabel(locale, "fuel", rrrCars.fuel),
  carPowerKw: rrrCars.powerKw,
  carEngineCc: rrrCars.engineCc,
  carColor: carLabel(locale, "color", rrrCars.color),
  carWheelDrive: carLabel(locale, "wheelDrive", rrrCars.wheelDrive),
  carSteering: carLabel(locale, "steering", rrrCars.steering),
  carGearbox: carLabel(locale, "gearbox", rrrCars.gearbox),
});

/**
 * One page of our own donor cars, newest first like RRR. Unlike brands and models this isn't a shared
 * catalogue, so a new car appears here as soon as it syncs. Narrows to the chosen brand or model, if any.
 */
export async function searchCars(
  q: string,
  { brand, model }: { brand: string | null; model: number | null },
  limit: number,
  offset: number,
) {
  const { locale } = await getI18n();
  const columns = carOptionColumns(locale);
  const text = sql`lower(concat_ws(' ', ${rrrCars.id}, ${columns.carBrand}, ${columns.carModel}, ${rrrCars.year},
    ${columns.carBodyType}, ${columns.carFuel}, ${columns.carColor}, ${columns.carWheelDrive},
    ${columns.carSteering}, ${columns.carGearbox}))`;
  const terms = q.toLowerCase().replaceAll("#", " ").split(/\s+/).filter(Boolean).slice(0, MAX_SEARCH_TERMS);

  const rows = await getDb()
    .select(columns)
    .from(rrrCars)
    .leftJoin(rrrCarModels, eq(rrrCarModels.id, rrrCars.modelId))
    .where(
      and(
        brand ? eq(rrrCarModels.brand, brand) : undefined,
        model ? eq(rrrCars.modelId, model) : undefined,
        ...terms.map((term) => sql`${text} like ${`%${term.replace(/[\\%_]/g, "\\$&")}%`}`),
      ),
    )
    .orderBy(desc(rrrCars.id))
    .limit(limit)
    .offset(offset);

  return rows.map((row) => ({ id: row.id, label: carOption(row) }));
}

/** The chosen car's name, for the filter chip. */
export async function carLabelFor(car: number | null) {
  if (!car) return null;
  const { locale } = await getI18n();
  const [row] = await getDb()
    .select(carOptionColumns(locale))
    .from(rrrCars)
    .leftJoin(rrrCarModels, eq(rrrCarModels.id, rrrCars.modelId))
    .where(eq(rrrCars.id, car));
  return row ? carOption(row) : null;
}

/** The chosen model's name, for the filter chip. */
export async function carModelLabel(model: number | null) {
  if (!model) return null;
  const [row] = await getDb()
    .select({
      carBrand: rrrCarModels.brand,
      carModel: rrrCarModels.name,
      carYearStart: rrrCarModels.yearStart,
      carYearEnd: rrrCarModels.yearEnd,
    })
    .from(rrrCarModels)
    .where(eq(rrrCarModels.id, model));
  return row ? carTitle(row) : null;
}

/** Every brand in RRR's catalogue, not only ones in stock, in the order RRR lists them. */
export async function listCarBrands() {
  const rows = await getDb().selectDistinct({ brand: rrrCarModels.brand }).from(rrrCarModels);
  const brands = rows.map((row) => row.brand).sort((a, b) => a.localeCompare(b, "en"));
  return [
    ...TOP_BRANDS.filter((brand) => brands.includes(brand)),
    ...brands.filter((brand) => !TOP_BRANDS.includes(brand)),
  ];
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

/** One search word: found in the part's name or codes, its category in any language, or its car's brand and model. */
function termFilter(term: string) {
  const pattern = `%${term.replace(/[\\%_]/g, "\\$&")}%`;
  const carIds = sql`(
    select ${rrrCars.id} from ${rrrCars}
    join ${rrrCarModels} on ${rrrCarModels.id} = ${rrrCars.modelId}
    where lower(${rrrCarModels.brand} || ' ' || ${rrrCarModels.name}) like ${pattern}
  )`;
  // All three languages match whichever one the site is showing, because people search in what they know.
  const categoryIds = sql`(
    select ${rrrCategories.id} from ${rrrCategories}
    where lower(concat_ws(' ', ${rrrCategories.name}, ${rrrCategories.nameEn}, ${rrrCategories.nameRu})) like ${pattern}
  )`;
  return or(
    sql`${partSearchText(parts)} like ${pattern}`,
    sql`${parts.rrrCarId} in ${carIds}`,
    sql`${parts.rrrCategoryId} in ${categoryIds}`,
  );
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

export async function listParts(query: PartsQuery) {
  const { q, page, pageSize, category, model } = query;
  const db = getDb();
  const { locale } = await getI18n();
  const where = and(isNull(parts.deletedAt), filtersFor(query), searchFilter(q), similarFilter({ category, model }));

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
        name: partName(locale),
        manufacturerCode: parts.manufacturerCode,
        visibleCode: parts.visibleCode,
        otherCode: parts.otherCode,
        price: parts.price,
        currency: parts.currency,
        status: parts.status,
        quality: parts.quality,
        category: categoryName(locale),
        notes: parts.notes,
        ...rawColumns,
        ...carColumns(locale),
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
  // A model on its own has its own filter chip; this label is for the "Sandėlyje" links.
  if (!category) return null;
  const db = getDb();
  const { locale } = await getI18n();
  const [[categoryRow], [modelRow]] = await Promise.all([
    category
      ? db
          .select({ name: categoryName(locale) })
          .from(rrrCategories)
          .where(eq(rrrCategories.id, category))
      : [],
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
  const { locale } = await getI18n();
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
        name: partName(locale),
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
      .leftJoin(rrrCategories, eq(rrrCategories.id, parts.rrrCategoryId))
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
  const { locale } = await getI18n();

  const [[part], photos] = await Promise.all([
    db
      .select({
        id: parts.id,
        rrrId: partListings.externalId,
        rrrUrl: sql<string | null>`${partListings.raw}->>'shop_url'`,
        name: partName(locale),
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
        categoryPath: categoryPath(locale),
        ...rawColumns,
        ...carColumns(locale),
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

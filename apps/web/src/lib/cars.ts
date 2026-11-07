import { cache } from "react";
import { and, count, desc, eq, gte, inArray, isNull, lte, parts, rrrCarModels, rrrCars, sql } from "@deremika/db";
import type { CarsQuery } from "./cars-query";
import { getDb } from "./db";
import type { Locale } from "./i18n";
import { getI18n } from "./i18n-server";
import { carLabel, MAX_SEARCH_TERMS } from "./parts";

const LABELLED_FIELDS = {
  fuel: rrrCars.fuel,
  gearbox: rrrCars.gearbox,
  wheelDrive: rrrCars.wheelDrive,
  steering: rrrCars.steering,
} as const;

function carFilters(query: CarsQuery) {
  const { q, brand, model, fuels, gearboxes, wheelDrives, steerings } = query;
  const { powerMin, powerMax, engineCcMin, engineCcMax } = query;
  // VIN and engine code live only in the raw payload; they're worth searching but not showing in the list.
  const text = sql`lower(concat_ws(' ', ${rrrCars.id}, ${rrrCarModels.brand}, ${rrrCarModels.name}, ${rrrCars.year},
    ${rrrCars.raw}->>'car_body_number', ${rrrCars.raw}->>'car_engine_code'))`;
  const terms = q.toLowerCase().replaceAll("#", " ").split(/\s+/).filter(Boolean).slice(0, MAX_SEARCH_TERMS);

  return and(
    brand ? eq(rrrCarModels.brand, brand) : undefined,
    model ? eq(rrrCars.modelId, model) : undefined,
    fuels.length > 0 ? inArray(rrrCars.fuel, fuels) : undefined,
    gearboxes.length > 0 ? inArray(rrrCars.gearbox, gearboxes) : undefined,
    wheelDrives.length > 0 ? inArray(rrrCars.wheelDrive, wheelDrives) : undefined,
    steerings.length > 0 ? inArray(rrrCars.steering, steerings) : undefined,
    powerMin !== null ? gte(rrrCars.powerKw, powerMin) : undefined,
    powerMax !== null ? lte(rrrCars.powerKw, powerMax) : undefined,
    engineCcMin !== null ? gte(rrrCars.engineCc, engineCcMin) : undefined,
    engineCcMax !== null ? lte(rrrCars.engineCc, engineCcMax) : undefined,
    ...terms.map((term) => sql`${text} like ${`%${term.replace(/[\\%_]/g, "\\$&")}%`}`),
  );
}

const carRowColumns = (locale: Locale) => ({
  id: rrrCars.id,
  brand: rrrCarModels.brand,
  model: rrrCarModels.name,
  year: rrrCars.year,
  fuel: carLabel(locale, "fuel", rrrCars.fuel),
  gearbox: carLabel(locale, "gearbox", rrrCars.gearbox),
  wheelDrive: carLabel(locale, "wheelDrive", rrrCars.wheelDrive),
  steering: carLabel(locale, "steering", rrrCars.steering),
  bodyType: carLabel(locale, "bodyType", rrrCars.bodyType),
  color: carLabel(locale, "color", rrrCars.color),
  engineCc: rrrCars.engineCc,
  powerKw: rrrCars.powerKw,
  // Car photos stay on Ovoko for now: they're small thumbnails, and only some cars have them.
  photoUrl: sql<string | null>`coalesce(
    (select photo->>'thumb' from jsonb_array_elements(${rrrCars.raw}->'car_photo_gallery') photo
     order by (photo->>'main')::boolean desc nulls last limit 1),
    nullif(${rrrCars.raw}->>'photo', ''))`,
  photoCount: sql<number>`coalesce(jsonb_array_length(${rrrCars.raw}->'car_photo_gallery'), 0)`,
});

/** Our donor cars, newest first, with how many of their parts are in stock and sold, like RRR's "Likutis" and "Parduota". */
export async function listCars(query: CarsQuery) {
  const db = getDb();
  const { locale } = await getI18n();
  const where = carFilters(query);

  const [rows, [{ total }]] = await Promise.all([
    db
      .select(carRowColumns(locale))
      .from(rrrCars)
      .leftJoin(rrrCarModels, eq(rrrCarModels.id, rrrCars.modelId))
      .where(where)
      .orderBy(desc(rrrCars.id))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db
      .select({ total: count() })
      .from(rrrCars)
      .leftJoin(rrrCarModels, eq(rrrCarModels.id, rrrCars.modelId))
      .where(where),
  ]);

  const ids = rows.map((row) => row.id);
  const counts =
    ids.length === 0
      ? []
      : await db
          .select({
            carId: parts.rrrCarId,
            inStock: sql<number>`count(*) filter (where ${parts.status} = 'in_stock')::int`,
            sold: sql<number>`count(*) filter (where ${parts.status} = 'sold')::int`,
          })
          .from(parts)
          .where(and(inArray(parts.rrrCarId, ids), isNull(parts.deletedAt)))
          .groupBy(parts.rrrCarId);
  const byCar = new Map(counts.map((row) => [row.carId, row]));

  return {
    total,
    rows: rows.map((row) => ({ ...row, inStock: byCar.get(row.id)?.inStock ?? 0, sold: byCar.get(row.id)?.sold ?? 0 })),
  };
}

export type CarRow = Awaited<ReturnType<typeof listCars>>["rows"][number];

export type CarFilterOption = { value: string; label: string };

/** The fuel and gearbox values our cars actually have, as stored and as shown in the viewer's language. */
export async function carFilterOptions() {
  const db = getDb();
  const { locale } = await getI18n();
  const options = async (field: keyof typeof LABELLED_FIELDS) => {
    const rows = await db
      .selectDistinct({ value: LABELLED_FIELDS[field], label: carLabel(locale, field, LABELLED_FIELDS[field]) })
      .from(rrrCars)
      .where(sql`${LABELLED_FIELDS[field]} is not null`);
    return rows
      .map((row) => ({ value: row.value!, label: row.label ?? row.value! }))
      .sort((a, b) => a.label.localeCompare(b.label));
  };
  const [fuels, gearboxes, wheelDrives, steerings, brandRows] = await Promise.all([
    options("fuel"),
    options("gearbox"),
    options("wheelDrive"),
    options("steering"),
    db
      .selectDistinct({ brand: rrrCarModels.brand })
      .from(rrrCars)
      .innerJoin(rrrCarModels, eq(rrrCarModels.id, rrrCars.modelId)),
  ]);
  const brands = brandRows.map((row) => row.brand).sort((a, b) => a.localeCompare(b, "en"));
  return { fuels, gearboxes, wheelDrives, steerings, brands };
}

/** RRR leaves empty text fields as "" rather than null. */
const rawText = (field: string) => sql<string | null>`nullif(trim(${rrrCars.raw}->>${field}), '')`;

/** One car with everything RRR's car page shows that the API gives us, and what its parts are worth by status. */
export const getCar = cache(async (id: number) => {
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const db = getDb();
  const { locale } = await getI18n();
  // Templates, write-offs and parts under audit aren't stock, so they stay out of the totals.
  const counted = inArray(parts.status, ["in_stock", "reserved", "sold"]);

  const [[car], [stats]] = await Promise.all([
    db
      .select({
        ...carRowColumns(locale),
        yearStart: rrrCarModels.yearStart,
        yearEnd: rrrCarModels.yearEnd,
        mileageKm: sql<number | null>`nullif(${rrrCars.raw}->>'car_mileage', '')::int`,
        vin: rawText("car_body_number"),
        engineCode: rawText("car_engine_code"),
        gearboxCode: rawText("car_gearbox_code"),
        colorCode: rawText("car_color_code"),
        interior: rawText("car_interior"),
        defects: rawText("defectation_notes"),
        // The watermarked 1024px copy for viewing, the small one for thumbnails.
        photos: sql<{ url: string; thumb: string | null }[]>`coalesce((
          select jsonb_agg(jsonb_build_object(
            'url', coalesce(photo->>'marked', photo->>'original', photo->>'path'),
            'thumb', photo->>'thumb'
          ) order by (photo->>'main')::boolean desc nulls last, (photo->>'sort')::int nulls last)
          from jsonb_array_elements(${rrrCars.raw}->'car_photo_gallery') photo
        ), '[]'::jsonb)`,
      })
      .from(rrrCars)
      .leftJoin(rrrCarModels, eq(rrrCarModels.id, rrrCars.modelId))
      .where(eq(rrrCars.id, id))
      .limit(1),
    db
      .select({
        all: sql<number>`count(*) filter (where ${counted})::int`,
        allValue: sql<number>`coalesce(sum(${parts.price}) filter (where ${counted}), 0)::float`,
        inStock: sql<number>`count(*) filter (where ${parts.status} = 'in_stock')::int`,
        inStockValue: sql<number>`coalesce(sum(${parts.price}) filter (where ${parts.status} = 'in_stock'), 0)::float`,
        reserved: sql<number>`count(*) filter (where ${parts.status} = 'reserved')::int`,
        reservedValue: sql<number>`coalesce(sum(${parts.price}) filter (where ${parts.status} = 'reserved'), 0)::float`,
        sold: sql<number>`count(*) filter (where ${parts.status} = 'sold')::int`,
        soldValue: sql<number>`coalesce(sum(${parts.price}) filter (where ${parts.status} = 'sold'), 0)::float`,
        unpriced: sql<number>`count(*) filter (where ${parts.status} = 'in_stock' and coalesce(${parts.price}, 0) = 0)::int`,
      })
      .from(parts)
      .where(and(eq(parts.rrrCarId, id), isNull(parts.deletedAt))),
  ]);

  return car ? { ...car, stats } : null;
});

export type CarDetail = NonNullable<Awaited<ReturnType<typeof getCar>>>;

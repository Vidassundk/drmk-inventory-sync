import { sql } from "drizzle-orm";
import { rrrCarModels, rrrCars, rrrCategories, type Db } from "@drmk/db";
import type { RrrCar, RrrCategory, RrrClient, RrrLookup, RrrNames } from "@drmk/rrr-client";
import { exclusive } from "../lock.ts";
import { withRetry } from "./sync.ts";

const BATCH_SIZE = 100;
const CATEGORY_BATCH_SIZE = 500;

const int = (v: string | null | undefined) => {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

type Language = keyof RrrNames;
type Labels = Record<RrrLookup, Record<string, RrrNames>>;

// RRR's "nothing selected" entries are empty or dashes.
const label = (labels: Record<string, RrrNames>, code: string, language: Language) => {
  const name = labels[code]?.[language]?.trim();
  return name && !/^-+$/.test(name) ? name : null;
};

/** The car's coded fields in one language. */
const carLabels = (car: RrrCar, labels: Labels, language: Language) => ({
  bodyType: label(labels.car_body_type, car.car_body_type, language),
  fuel: label(labels.fuel, car.car_fuel, language),
  color: label(labels.color, car.car_color, language),
  wheelDrive: label(labels.wheel_drive, car.car_wheel_drive, language),
  steering: label(labels.wheel, car.car_wheel_type, language),
  gearbox: label(labels.gearbox_type, car.car_gearbox_type, language),
});

async function syncModels(db: Db, rrr: RrrClient) {
  const brands = await withRetry(() => rrr.getCarBrands(), "car brands");
  let count = 0;
  for (const brand of brands) {
    const models = await withRetry(() => rrr.getCarModels(brand.id), `car models of ${brand.name}`);
    if (models.length === 0) continue;
    await db
      .insert(rrrCarModels)
      .values(
        models.map((m) => ({
          id: Number(m.id),
          brand: brand.name,
          name: m.name,
          yearStart: int(m.year_start),
          yearEnd: int(m.year_end),
        })),
      )
      .onConflictDoUpdate({
        target: rrrCarModels.id,
        set: {
          brand: sql`excluded.brand`,
          name: sql`excluded.name`,
          yearStart: sql`excluded.year_start`,
          yearEnd: sql`excluded.year_end`,
          updatedAt: new Date(),
        },
      });
    count += models.length;
  }
  return count;
}

async function syncCategories(db: Db, rrr: RrrClient) {
  const categories = await withRetry(() => rrr.getCategories(), "categories");
  const byId = new Map(categories.map((c) => [c.id, c]));
  const nameOf = (c: RrrCategory, language: Language) => c[language] ?? null;

  const pathOf = (c: RrrCategory, language: Language) => {
    const names = [nameOf(c, language)];
    for (let parent = byId.get(c.parent_id); parent; parent = byId.get(parent.parent_id)) {
      names.unshift(nameOf(parent, language));
    }
    // A gap anywhere means no full path in this language, and the page falls back to Lithuanian.
    return names.every(Boolean) ? names.join(" › ") : null;
  };

  const rows = categories.map((c) => ({
    id: Number(c.id),
    parentId: int(c.parent_id),
    name: nameOf(c, "lt") ?? c.en ?? "",
    nameEn: nameOf(c, "en"),
    nameRu: nameOf(c, "ru"),
    path: pathOf(c, "lt") ?? "",
    pathEn: pathOf(c, "en"),
    pathRu: pathOf(c, "ru"),
  }));
  for (let i = 0; i < rows.length; i += CATEGORY_BATCH_SIZE) {
    await db
      .insert(rrrCategories)
      .values(rows.slice(i, i + CATEGORY_BATCH_SIZE))
      .onConflictDoUpdate({
        target: rrrCategories.id,
        set: {
          parentId: sql`excluded.parent_id`,
          name: sql`excluded.name`,
          nameEn: sql`excluded.name_en`,
          nameRu: sql`excluded.name_ru`,
          path: sql`excluded.path`,
          pathEn: sql`excluded.path_en`,
          pathRu: sql`excluded.path_ru`,
          updatedAt: new Date(),
        },
      });
  }
  return rows.length;
}

async function upsertCars(db: Db, cars: RrrCar[], labels: Labels) {
  if (cars.length === 0) return;
  await db
    .insert(rrrCars)
    .values(
      cars.map((c) => ({
        id: Number(c.id),
        modelId: int(c.car_model),
        year: int(c.car_years),
        ...carLabels(c, labels, "lt"),
        powerKw: int(c.car_engine_power),
        engineCc: int(c.car_engine_cubic_capacity),
        translations: { en: carLabels(c, labels, "en"), ru: carLabels(c, labels, "ru") },
        raw: c,
      })),
    )
    .onConflictDoUpdate({
      target: rrrCars.id,
      set: {
        modelId: sql`excluded.model_id`,
        year: sql`excluded.year`,
        bodyType: sql`excluded.body_type`,
        fuel: sql`excluded.fuel`,
        powerKw: sql`excluded.power_kw`,
        engineCc: sql`excluded.engine_cc`,
        color: sql`excluded.color`,
        wheelDrive: sql`excluded.wheel_drive`,
        steering: sql`excluded.steering`,
        gearbox: sql`excluded.gearbox`,
        translations: sql`excluded.translations`,
        raw: sql`excluded.raw`,
        updatedAt: new Date(),
      },
    });
}

/**
 * Refreshes donor cars. By default only the newest page, which is cheap enough to run after every
 * incremental sync. `all` also rebuilds the model and category catalogs and re-reads every car, picking up edits.
 */
export function syncRrrCars(db: Db, rrr: RrrClient, { all = false } = {}) {
  return exclusive(db.$client, "sync:rrr:cars", async () => {
    const started = Date.now();
    const models = all ? await syncModels(db, rrr) : 0;
    const categories = all ? await syncCategories(db, rrr) : 0;

    const lookups: RrrLookup[] = ["fuel", "color", "wheel_drive", "car_body_type", "wheel", "gearbox_type"];
    const tables = await Promise.all(lookups.map((name) => withRetry(() => rrr.getLookup(name), `lookup ${name}`)));
    const labels = Object.fromEntries(lookups.map((name, index) => [name, tables[index]])) as Labels;

    let cars = 0;
    if (all) {
      let batch: RrrCar[] = [];
      for await (const car of rrr.iterateCars()) {
        batch.push(car);
        if (batch.length === BATCH_SIZE) {
          await upsertCars(db, batch, labels);
          cars += batch.length;
          batch = [];
        }
      }
      await upsertCars(db, batch, labels);
      cars += batch.length;
    } else {
      const { cars: newest } = await withRetry(() => rrr.getCars(), "newest cars");
      await upsertCars(db, newest, labels);
      cars = newest.length;
    }

    const stats = { models, categories, cars };
    console.log(`rrr:cars done in ${Math.round((Date.now() - started) / 1000)}s`, stats);
    return stats;
  });
}

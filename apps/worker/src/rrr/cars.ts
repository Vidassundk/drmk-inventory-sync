import { sql } from "drizzle-orm";
import { rrrCarModels, rrrCars, type Db } from "@deremika/db";
import type { RrrCar, RrrClient, RrrLookup } from "@deremika/rrr-client";
import { exclusive } from "../lock.ts";
import { withRetry } from "./sync.ts";

const BATCH_SIZE = 100;

const int = (v: string | null | undefined) => {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

// RRR's "nothing selected" entries are empty or dashes.
const label = (labels: Record<string, string>, code: string) => {
  const name = labels[code]?.trim();
  return name && !/^-+$/.test(name) ? name : null;
};

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

async function upsertCars(db: Db, cars: RrrCar[], labels: Record<RrrLookup, Record<string, string>>) {
  if (cars.length === 0) return;
  await db
    .insert(rrrCars)
    .values(
      cars.map((c) => ({
        id: Number(c.id),
        modelId: int(c.car_model),
        year: int(c.car_years),
        bodyType: label(labels.car_body_type, c.car_body_type),
        fuel: label(labels.fuel, c.car_fuel),
        powerKw: int(c.car_engine_power),
        engineCc: int(c.car_engine_cubic_capacity),
        color: label(labels.color, c.car_color),
        wheelDrive: label(labels.wheel_drive, c.car_wheel_drive),
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
        raw: sql`excluded.raw`,
        updatedAt: new Date(),
      },
    });
}

/**
 * Refreshes donor cars. By default only the newest page, which is cheap enough to run after every
 * incremental sync. `all` also rebuilds the model catalog and re-reads every car, picking up edits.
 */
export function syncRrrCars(db: Db, rrr: RrrClient, { all = false } = {}) {
  return exclusive(db.$client, "sync:rrr:cars", async () => {
    const started = Date.now();
    const models = all ? await syncModels(db, rrr) : 0;

    const [fuel, color, wheel_drive, car_body_type] = await Promise.all(
      (["fuel", "color", "wheel_drive", "car_body_type"] as const).map((name) =>
        withRetry(() => rrr.getLookup(name), `lookup ${name}`),
      ),
    );
    const labels = { fuel, color, wheel_drive, car_body_type };

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

    const stats = { models, cars };
    console.log(`rrr:cars done in ${Math.round((Date.now() - started) / 1000)}s`, stats);
    return stats;
  });
}

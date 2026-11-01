// Our own inventory model. RRR is the first channel feeding it; parts get our
// own ids so later channels (and writes back to RRR) don't need a migration.
// Every table has RLS on with no policies: only server-side connections read it.
import { sql } from "drizzle-orm";
import {
  bigserial,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

// "unknown" covers RRR codes outside /get/part_status (e.g. 7); the raw code is kept in part_listings.raw.
export const partStatus = pgEnum("part_status", ["in_stock", "reserved", "sold", "returned", "written_off", "unknown"]);
export const imageStatus = pgEnum("image_status", ["pending", "stored", "failed"]);
export const syncKind = pgEnum("sync_kind", ["full", "incremental"]);
export const syncStatus = pgEnum("sync_status", ["running", "succeeded", "failed"]);

export const channels = pgTable("channels", {
  id: text("id").primaryKey(), // "rrr", later "ebay", "shop", ...
  name: text("name").notNull(),
  createdAt: createdAt(),
}).enableRLS();

export const parts = pgTable(
  "parts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    manufacturerCode: text("manufacturer_code"),
    visibleCode: text("visible_code"),
    otherCode: text("other_code"),
    notes: text("notes"),
    internalNotes: text("internal_notes"),
    price: numeric("price", { precision: 12, scale: 2 }),
    currency: text("currency"),
    quality: smallint("quality"),
    status: partStatus("status").notNull(),
    // RRR catalog ids until we own category/car catalogs and map them per channel.
    rrrCategoryId: integer("rrr_category_id"),
    rrrCarId: integer("rrr_car_id"),
    listedAt: timestamp("listed_at", { withTimezone: false, mode: "string" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("parts_status_idx").on(t.status),
    index("parts_manufacturer_code_idx").on(t.manufacturerCode),
    index("parts_rrr_category_idx").on(t.rrrCategoryId),
  ],
).enableRLS();

/** One row per part per channel: how that channel knows the part, and its last raw payload. */
export const partListings = pgTable(
  "part_listings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    partId: uuid("part_id")
      .notNull()
      .references(() => parts.id, { onDelete: "cascade" }),
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id),
    externalId: text("external_id").notNull(),
    /** The channel's own updated_at, verbatim (RRR: naive Europe/Vilnius time). */
    externalUpdatedAt: timestamp("external_updated_at", { withTimezone: false, mode: "string" }),
    raw: jsonb("raw").notNull(),
    contentHash: text("content_hash").notNull(),
    lastSeenRunId: integer("last_seen_run_id"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    /** Set when a full scan no longer finds the part on the channel. */
    removedAt: timestamp("removed_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("part_listings_channel_external_uq").on(t.channelId, t.externalId),
    uniqueIndex("part_listings_part_channel_uq").on(t.partId, t.channelId),
    index("part_listings_external_updated_idx").on(t.channelId, t.externalUpdatedAt),
  ],
).enableRLS();

/** One row per source image. Files are rehosted to R2 under their sha256. */
export const images = pgTable(
  "images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceUrl: text("source_url").notNull(),
    status: imageStatus("status").notNull().default("pending"),
    sha256: text("sha256"),
    storageKey: text("storage_key"),
    contentType: text("content_type"),
    bytes: integer("bytes"),
    width: integer("width"),
    height: integer("height"),
    attempts: smallint("attempts").notNull().default(0),
    lastError: text("last_error"),
    storedAt: timestamp("stored_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("images_source_url_uq").on(t.sourceUrl),
    index("images_pending_idx")
      .on(t.createdAt)
      .where(sql`${t.status} = 'pending'`),
  ],
).enableRLS();

export const partImages = pgTable(
  "part_images",
  {
    partId: uuid("part_id")
      .notNull()
      .references(() => parts.id, { onDelete: "cascade" }),
    imageId: uuid("image_id")
      .notNull()
      .references(() => images.id),
    position: smallint("position").notNull(),
  },
  (t) => [primaryKey({ columns: [t.partId, t.position] }), index("part_images_image_idx").on(t.imageId)],
).enableRLS();

export const syncRuns = pgTable(
  "sync_runs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    channelId: text("channel_id")
      .notNull()
      .references(() => channels.id),
    kind: syncKind("kind").notNull(),
    status: syncStatus("status").notNull().default("running"),
    /** Incremental: highest external updated_at seen, the next run's starting point. */
    cursor: text("cursor"),
    stats: jsonb("stats").$type<Record<string, number>>().notNull().default({}),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("sync_runs_channel_kind_idx").on(t.channelId, t.kind, t.startedAt)],
).enableRLS();

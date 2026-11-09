// Our own inventory model. RRR is the first channel feeding it; parts get our
// own ids so later channels (and writes back to RRR) don't need a migration.
// Every table has RLS on with no policies: only server-side connections read it.
import { sql, type SQLWrapper } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
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

// RRR codes 7 ("Dalių atsargų auditas", flagged in a stock count) and 8 ("Šablonas",
// a listing template, not a physical part) are missing from /get/part_status.
// "unknown" covers anything else new; the raw code stays in part_listings.raw.
export const partStatus = pgEnum("part_status", [
  "in_stock",
  "reserved",
  "sold",
  "returned",
  "written_off",
  "unknown",
  "stock_audit",
  "template",
]);
export const imageStatus = pgEnum("image_status", ["pending", "stored", "failed"]);
export const syncKind = pgEnum("sync_kind", ["full", "incremental"]);
export const syncStatus = pgEnum("sync_status", ["running", "succeeded", "failed"]);

export const channels = pgTable("channels", {
  id: text("id").primaryKey(), // "rrr", later "ebay", "shop", ...
  name: text("name").notNull(),
  createdAt: createdAt(),
}).enableRLS();

/** The text parts search runs over. The expression must match parts_search_idx exactly, or the index isn't used. */
export const partSearchText = (t: Record<"name" | "manufacturerCode" | "visibleCode" | "otherCode", SQLWrapper>) =>
  sql`lower(${t.name} || ' ' || coalesce(${t.manufacturerCode}, '') || ' ' || coalesce(${t.visibleCode}, '') || ' ' || coalesce(${t.otherCode}, ''))`;

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
    // Per-car part counts on the cars page, and the car filter.
    index("parts_rrr_car_idx").on(t.rrrCarId),
    // Back the newest-first list, so a page reads its rows in order instead of sorting the whole table.
    index("parts_listed_idx")
      .on(t.listedAt.desc(), t.id.desc())
      .where(sql`${t.deletedAt} is null`),
    index("parts_status_listed_idx")
      .on(t.status, t.listedAt.desc(), t.id.desc())
      .where(sql`${t.deletedAt} is null`),
    index("parts_search_idx").using("gin", sql`${partSearchText(t)} extensions.gin_trgm_ops`),
  ],
).enableRLS();

/** RRR's model catalog. Refreshed nightly; rrr_cars points at it by id. */
export const rrrCarModels = pgTable("rrr_car_models", {
  id: integer("id").primaryKey(),
  brand: text("brand").notNull(),
  name: text("name").notNull(),
  yearStart: smallint("year_start"),
  yearEnd: smallint("year_end"),
  updatedAt: updatedAt(),
}).enableRLS();

/**
 * Donor cars from RRR, with its codes already translated to names. The columns hold Lithuanian, and `translations`
 * holds the same six fields for other languages: { en: { bodyType, ... }, ru: { ... } }. Parts link by parts.rrr_car_id.
 */
export const rrrCars = pgTable("rrr_cars", {
  id: integer("id").primaryKey(),
  modelId: integer("model_id"),
  year: smallint("year"),
  bodyType: text("body_type"),
  fuel: text("fuel"),
  powerKw: smallint("power_kw"),
  engineCc: integer("engine_cc"),
  color: text("color"),
  wheelDrive: text("wheel_drive"),
  steering: text("steering"),
  gearbox: text("gearbox"),
  translations: jsonb("translations"),
  raw: jsonb("raw").notNull(),
  updatedAt: updatedAt(),
}).enableRLS();

/**
 * RRR's part category tree. `name` and `path` are Lithuanian, with English and Russian alongside; `path` is the full
 * trail, ready to display. Part names come from here, so translating this table translates every part. Parts link
 * by parts.rrr_category_id.
 */
export const rrrCategories = pgTable("rrr_categories", {
  id: integer("id").primaryKey(),
  parentId: integer("parent_id"),
  name: text("name").notNull(),
  nameEn: text("name_en"),
  nameRu: text("name_ru"),
  path: text("path").notNull(),
  pathEn: text("path_en"),
  pathRu: text("path_ru"),
  updatedAt: updatedAt(),
}).enableRLS();

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

// Sign-in, managed by Better Auth (apps/web/src/lib/auth.ts). Invite-only: a user row is created when someone is
// invited, and Better Auth refuses codes for any email without one. Table and column names are ours; the field names
// are what Better Auth expects.

export const userRole = pgEnum("user_role", ["admin", "member"]);
export type UserRole = (typeof userRole.enumValues)[number];

export const authUsers = pgTable("auth_users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  /** False until the invited person signs in for the first time. */
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: userRole("role").notNull().default("member"),
  /** Language for emails: lt, en or ru. */
  locale: text("locale").notNull().default("lt"),
  invitedBy: text("invited_by"),
  lastSignInAt: timestamp("last_sign_in_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}).enableRLS();

export const authSessions = pgTable(
  "auth_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("auth_sessions_user_idx").on(t.userId)],
).enableRLS();

/** Unused by code sign-in, but Better Auth requires the table. */
export const authAccounts = pgTable(
  "auth_accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("auth_accounts_user_idx").on(t.userId)],
).enableRLS();

/** Sign-in codes, stored hashed. */
export const authVerifications = pgTable(
  "auth_verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("auth_verifications_identifier_idx").on(t.identifier)],
).enableRLS();

/** Request counts per IP and endpoint. In the database because each Worker instance has its own memory. */
export const authRateLimits = pgTable("auth_rate_limits", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
}).enableRLS();

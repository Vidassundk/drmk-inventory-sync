# @deremika/db

The Drizzle schema, migrations and database client, for Supabase Postgres.

```ts
import { createDb, parts } from "@deremika/db";

const { db, client } = createDb(); // reads DATABASE_URL
const rows = await db.select().from(parts).limit(10);
await client.end();
```

## Tables

| Table            | Holds                                                                    |
| ---------------- | ------------------------------------------------------------------------ |
| `parts`          | Our own record of each part, independent of any marketplace              |
| `channels`       | Marketplaces. Currently just `rrr`                                       |
| `part_listings`  | A part on one channel: external ID, raw payload, content hash, last seen |
| `images`         | One row per source photo, with its R2 location and copy status           |
| `part_images`    | Which images belong to which part, in order                              |
| `rrr_cars`       | Donor cars with their codes translated to Lithuanian names               |
| `rrr_car_models` | RRR's brand and model catalog                                            |
| `rrr_categories` | RRR's category tree in Lithuanian, with each category's full path        |
| `sync_runs`      | History of sync jobs, with their stats and cursor                        |

Removed parts are kept, with `deleted_at` set. `parts` and `part_listings` are separate so that one part can later be listed on several marketplaces.

## Part statuses

| RRR code | Status        | RRR name                    |
| -------- | ------------- | --------------------------- |
| 0        | `in_stock`    | In stock                    |
| 1        | `reserved`    | Reserved                    |
| 2        | `sold`        | Sold                        |
| 3        | `returned`    | Returned                    |
| 4        | `written_off` | Written off                 |
| 7        | `stock_audit` | Dalių atsargų auditas       |
| 8        | `template`    | Šablonas                    |
| other    | `unknown`     | Counted in the sync's stats |

## Listing parts at scale

- `parts_listed_idx` and `parts_status_listed_idx` back the newest-first list. A query's `ORDER BY` must match them exactly, or Postgres sorts the whole table for every page.
- `parts_search_idx` is a trigram index for "contains" search. Queries must use `partSearchText`, so the expression matches the index.
- For paged lists, select the page's IDs first and join afterwards. Joining before `OFFSET` also joins every skipped row: page 400 took 7.7 seconds that way, and 0.5 seconds after the change.

## Migrations

Edit `src/schema.ts`, then from the repo root:

```bash
pnpm db:generate
```

```bash
pnpm db:migrate
```

Commit the generated files in `migrations/`.

## Connecting

Use Supabase's **session pooler** URL. The direct URL is IPv6-only and won't connect from most networks, including GitHub Actions.

## Access

Every table has row-level security on with no policies, and the `anon` and `authenticated` roles have no grants, so Supabase's public API can't read this data. Only the `DATABASE_URL` connection can. If a new table is added, keep it this way.

# drmk-inventory-sync

Mirrors our RRR (rrr.lt / Ovoko) auto-parts inventory into our own database and copies every photo to our own storage.

- **Phase 1 (now):** a read-only live mirror, plus a team-only dashboard.
- **Phase 2:** edit stock from the dashboard and push the changes to RRR.
- **Later:** sync to several marketplaces, with our database as the source of truth.

## How it fits together

```text
Cloudflare Worker (apps/scheduler)
  │  starts workflows on time
  ▼
GitHub Actions ── runs ──▶ apps/worker
                            ├─ reads parts from the RRR API
                            ├─ writes them to Supabase Postgres
                            └─ copies photos from Ovoko to Cloudflare R2
```

## Layout

| Path                                                   | What it is                                      |
| ------------------------------------------------------ | ----------------------------------------------- |
| `apps/web`                                             | Next.js dashboard, hosted on Cloudflare Workers |
| [`apps/worker`](apps/worker/README.md)                 | Sync and image jobs                             |
| [`apps/scheduler`](apps/scheduler/README.md)           | Cloudflare Worker that starts the jobs on time  |
| [`packages/db`](packages/db/README.md)                 | Drizzle schema, migrations and database client  |
| [`packages/rrr-client`](packages/rrr-client/README.md) | Typed client for the RRR API                    |

## Getting started

Needs Node 24 (`.ts` files run directly, with no build step) and pnpm.

```bash
pnpm install
cp .env.example .env
```

Fill in `.env`. It is gitignored, so credentials never reach the repo. Then check the RRR connection:

```bash
pnpm smoke:rrr
```

## Translations

Interface text lives in `apps/web/src/messages`, one JSON file per language. Add a key to `lt.json` first; a key missing from `en.json` or `ru.json` fails the typecheck. Visitors pick a language in the header, and it's saved in a cookie. Part names, categories and car details come translated from RRR's catalogue, and fall back to Lithuanian if a translation is missing. Listing text stays as the team wrote it.

## Commands

| Command                                         | What it does                                                                                        |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `pnpm dev:web`                                  | Runs the dashboard locally                                                                          |
| `pnpm web:preview`                              | Builds the dashboard and runs it in the Cloudflare runtime locally                                  |
| `pnpm web:deploy`                               | Builds and deploys the dashboard to Cloudflare by hand                                              |
| `pnpm typecheck`                                | Typechecks every package                                                                            |
| `pnpm format` / `pnpm format:check`             | Formats or checks the repo with Prettier                                                            |
| `pnpm db:generate` / `db:migrate` / `db:studio` | Creates or applies migrations, opens Drizzle Studio                                                 |
| `pnpm sync:incremental` / `pnpm sync:full`      | Runs an RRR sync                                                                                    |
| `pnpm sync:cars [all]`                          | Refreshes donor cars: the newest page, or with `all` every car plus the model and category catalogs |
| `pnpm images:rehost [limit]`                    | Copies pending photos to R2                                                                         |
| `pnpm scheduler:deploy`                         | Deploys the Cloudflare scheduler                                                                    |

## Scheduled jobs

All three are started by `apps/scheduler`. Times are UTC.

| Workflow               | When             | What it does                                           |
| ---------------------- | ---------------- | ------------------------------------------------------ |
| `rrr-sync-incremental` | Every 15 minutes | Pulls parts changed on RRR and queues their new photos |
| `rrr-sync-full`        | Nightly at 02:41 | Walks every part, catching deletes and anything missed |
| `images-rehost`        | Hourly at :17    | Copies 95 photos, in-stock covers first                |

Any of them can also be started by hand from the repo's Actions tab.

## Secrets

| Where                                 | What                                                                                                                                                             |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.env`                                | Everything in `.env.example`, for local runs                                                                                                                     |
| GitHub → Settings → Secrets → Actions | `DATABASE_URL`, `RRR_USERNAME`, `RRR_PASSWORD`, `RRR_USER_TOKEN`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL` |
| Cloudflare Worker `drmk-scheduler`    | `GITHUB_TOKEN`                                                                                                                                                   |

This repo is public, and so are its Actions logs. Don't commit credentials or print part data in job output.

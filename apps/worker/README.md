# worker

The jobs that keep the mirror up to date. They run on GitHub Actions and can also be run locally from the repo root.

| Command                      | Job               | What it does                                            |
| ---------------------------- | ----------------- | ------------------------------------------------------- |
| `pnpm sync:incremental`      | `rrr:incremental` | Reads parts changed since the last successful run       |
| `pnpm sync:full`             | `rrr:full`        | Walks every part and marks missing ones as removed      |
| `pnpm sync:cars [all]`       | `rrr:cars`        | Refreshes donor cars and, with `all`, the model catalog |
| `pnpm images:rehost [limit]` | `images:rehost`   | Copies pending photos to R2, up to `limit` if given     |

Each job takes a Postgres advisory lock, so a second copy exits with an error instead of overlapping. The two sync jobs share one lock. Every sync is recorded in the `sync_runs` table.

## RRR sync

- **Incremental** sorts by `updated_at`, which RRR bumps on edits, price changes and sales. It re-reads the last 5 minutes on each run so that nothing on the boundary is lost.
- **Full** is the only way to notice hard deletes, because RRR doesn't report them. It refuses to remove anything if it saw under 95% of the expected total.
- `updated_at` is a plain Europe/Vilnius time with no timezone, so it's stored as a string. Around the autumn clock change the incremental can miss updates; the nightly full scan picks those up.

### Cars

Parts only carry a car ID, and RRR's cars only carry codes. `rrr:cars` translates them to Lithuanian names while syncing, so the dashboard doesn't need any code tables. It runs as a separate workflow step after each sync: the newest 100 cars after an incremental sync, and everything after the nightly full scan. An edit to an older car appears after the next nightly run.

### Photo URLs

Ovoko URLs contain a random corner segment (`/tl/`, `/tr/`, `/bl/`, `/br/`) that puts a watermark on the image and changes on every request. `canonicalPhotoUrl` strips it, which gives a clean and stable URL. Without this, every part looks changed on every sync. `1024x768` is the largest size available.

## Image rehosting

Photos are stored in R2 under the hash of their content (`parts/<sha[0:2]>/<sha256>.<ext>`), so identical files share one object. New images start as `pending` and go to `stored`, or to `failed` after 5 attempts. Copy order:

1. In-stock cover photos (the first photo of each part)
2. Other in-stock photos
3. Cover photos of parts not in stock
4. Everything else

Covers go first because list pages show them. Viewers' browsers load any uncopied photo from Ovoko, which should count against the same hourly limit.

**Ovoko allows about 100 image requests per hour per IP, however they are spaced.** Going over gets an HTTP 429 with an hour-long `Retry-After`, and any further request restarts that hour. The block also covers everyone else on the same connection. So:

- A 429 never counts as a failed attempt.
- Local runs send one request every 37 seconds, and wait out any block.
- Scheduled runs take 95 photos at one per second, then exit. If blocked, they stop and the next run carries on.

| Variable              | Default  | What it does                                |
| --------------------- | -------- | ------------------------------------------- |
| `REHOST_INTERVAL_MS`  | `37000`  | Time between requests                       |
| `REHOST_MAX_PAUSE_MS` | no limit | Stop the run if a block is longer than this |

Don't run a local copy while the scheduled job is due, because the lock will make one of them fail.

# web

The dashboard: Next.js 16 on Cloudflare Workers, through the OpenNext adapter. It reads the backup from Postgres and has its own invite-only sign-in.

Its name, logo, domains and email sender are in `brand/brand.json`, read at build time. A domain the dashboard is served from must be both there, which allows sign-in from it, and in `routes` in `wrangler.jsonc`.

## Layout

| Path                                     | What it is                                                   |
| ---------------------------------------- | ------------------------------------------------------------ |
| `src/app/(app)`                          | The signed-in pages: parts, cars and, for admins, users      |
| `src/app/login`                          | The sign-in page                                             |
| `src/app/api/auth`                       | Better Auth's endpoints: send a code, sign in, sign out      |
| `src/app/api/cars`, `api/car-models`     | Options for the car and model filters, loaded as they scroll |
| `src/lib/parts.ts`, `src/lib/cars.ts`    | Every inventory query                                        |
| `src/lib/auth.tsx`, `src/lib/session.ts` | Sign-in setup, and the checks pages and queries use          |
| `src/emails`                             | The sign-in code and invite emails                           |
| `src/messages`                           | Interface text in Lithuanian, English and Russian            |

## Running it locally

`pnpm dev:web` reads the root `.env`: the database URL, `BETTER_AUTH_SECRET` and, if set, `RESEND_API_KEY`. Without a Resend key, sign-in emails are printed in the terminal. Add yourself first with `pnpm users:add you@example.com admin`.

Restart the dev server after changing `globals.css`: it doesn't always pick up the change.

To try the production build in the Cloudflare runtime, put these in `apps/web/.dev.vars` (gitignored), then run `pnpm web:preview`:

```text
BETTER_AUTH_SECRET=any-long-random-string
EMAIL_LOG_ONLY=1
```

The preview also needs the database. Export `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` with the same value as `DATABASE_URL`.

## Deploying

```bash
pnpm web:deploy
```

This builds, removes every `.env` value from the build, checks none is left, and deploys to the domains in `wrangler.jsonc`. OpenNext copies `.env` files from this folder and the repo root into the Worker, and the root one holds the sync jobs' secrets. Don't deploy with `wrangler deploy` directly.

The Worker's own secrets, set once from this folder:

```bash
npx wrangler secret put BETTER_AUTH_SECRET
```

```bash
npx wrangler secret put RESEND_API_KEY
```

Emails go out from the brand's `emailFrom`, on a domain verified in Resend. `EMAIL_FROM` as a Worker variable overrides it.

## Sign-in

- **Invite-only.** Better Auth's email-code sign-in with sign-up turned off. A code is only sent to, and only accepted for, an email with a row in `auth_users`. Anyone else sees the same "check your inbox" screen, and nothing is sent.
- **Codes** last 10 minutes and allow 5 tries. Code emails are limited to 3 a minute per IP, counted in the database because each Worker instance has its own memory.
- **The email's button** opens `/login#email=…&code=…`. The `#` part never reaches a server or its logs. The page fills the code in but still waits for a click, because some mail filters open links and would use the code up.
- **Sessions** last 30 days. Pages check a signed cookie and only look at the database every 5 minutes, which is how long removing someone takes to apply.

## Rules for new code

- **Read inventory through `dataDb()`**, not `getDb()`. It checks for a signed-in person first, which also covers page titles and `/api` routes.
- **Apply the viewer's role in the data layer.** Non-admins don't see reservations or parts without a price: `queryFor` in `lib/parts-query.ts` and `hideReservation` in `lib/parts.ts`. Hiding something only in the page isn't enough.
- **Use `AppLink`, not `next/link`.** Prefetching every link in a table used up the database's connections.
- **Mind the connection limits.** Hyperdrive keeps at most 5 connections to Supabase's session pooler, which allows 15 in all. Each request opens one client and closes it when the response is done.
- **Leave `cacheComponents` off.** Pages hang in the Workers runtime with it on.
- **Translate every new text.** Add the key to `src/messages/lt.json`, then to `en.json` and `ru.json`; a missing one fails the typecheck.

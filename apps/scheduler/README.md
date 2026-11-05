# scheduler

A small Cloudflare Worker that starts the GitHub Actions workflows on time. It exists because GitHub's own `schedule:` trigger dropped most runs on this repo (2 of about 18 hourly runs fired), while manual starts work every time.

The Worker has no public URL. It only runs on its cron triggers and calls GitHub's `workflow_dispatch` API.

If GitHub answers with a 5xx or the network fails, it retries after 5 and then 15 seconds. A 4xx means the token or workflow is wrong, so it fails straight away.

## Changing a schedule

Update both of these, then deploy:

- `triggers.crons` in `wrangler.jsonc`
- `WORKFLOWS` in `src/index.ts`, which maps each cron to a workflow file

Cron times are UTC.

## Deploying

From the repo root:

```bash
pnpm --filter scheduler exec wrangler login
```

```bash
pnpm scheduler:deploy
```

## GitHub token

The Worker needs a fine-grained token with access to this repo only and **Actions: Read and write**.

```bash
pnpm --filter scheduler exec wrangler secret put GITHUB_TOKEN
```

**When the token expires, every scheduled job stops.** The Cloudflare dashboard shows the failures under the Worker's errors, but nothing else alerts you, so renew it before its expiry date.

## Testing locally

```bash
pnpm --filter scheduler exec wrangler dev --test-scheduled --var GITHUB_TOKEN:fake
```

```bash
curl "http://localhost:8787/__scheduled?cron=17+*+*+*+*"
```

With a fake token GitHub answers 401, which shows the cron reached the right workflow without starting it.

# @drmk/rrr-client

A typed client for the RRR API. API docs: <https://api.rrr.lt/docs/>

```ts
import { rrrClientFromEnv } from "@drmk/rrr-client";

const rrr = rrrClientFromEnv(); // reads RRR_USERNAME, RRR_PASSWORD, RRR_USER_TOKEN

const { parts, pagination } = await rrr.getParts({ page: 1, limit: 100 });

for await (const part of rrr.iterateParts()) {
  // every part, sorted by id
}

for await (const part of rrr.iteratePartsUpdatedSince("2026-11-01 00:00:00")) {
  // parts changed since then, newest first
}
```

Failed requests throw `RrrApiError`, which carries the HTTP status and RRR's status code.

To check your credentials, from the repo root:

```bash
pnpm smoke:rrr
```

## API notes

These were found by testing the live API, and some aren't in its docs.

- Use `https://api.rrr.lt/`. The storefront domains return a Cloudflare 403 challenge.
- Requests are POSTs with a form-encoded body containing the credentials.
- A successful response has `status_code: "R200"`.
- `limit` is at most 100, and a page takes 2–3.5 seconds.
- `sort` accepts only `id`, `create_date` and `updated_at`.
- `updated_at` isn't documented. It's a Europe/Vilnius time with no timezone.
- Sold parts stay in the list. Hard deletes aren't reported anywhere, including `/get/logs`.

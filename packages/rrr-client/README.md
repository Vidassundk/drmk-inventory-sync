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

Two calls change data on RRR, used by the dashboard's reservations:

```ts
const part = await rrr.getPart(970); // one part as RRR has it right now, or null
await rrr.changePartStatus(970, PART_STATUS.reserved); // and PART_STATUS.inStock to release it
await rrr.setInternalNotes(970, "Rezervacija …"); // staff-only notes in RRR
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
- `/crm/changePartStatus` needs CRM write access on the account. Tested on 2026-11-23: reserving and releasing one part worked.
- A part reserved through the API has `reserved_user: "0"`. Staff reserving on RRR get their own user number.
- `reserved_date` stays set after a part is released, so trust it only while the status is reserved.
- `/crm/updatePart` changes only the fields sent: sending just `internal_notes` leaves the rest of the part as it was. An empty or blank value is ignored, so notes can be replaced but not cleared through the API. Tested on 2026-11-23.
- Photo links name a random watermark corner (`/tl/`, `/br/` …) on every read, so compare photos without it.
- An account that has lost API access still gets `R200` with no parts and a total of 0, not an error.

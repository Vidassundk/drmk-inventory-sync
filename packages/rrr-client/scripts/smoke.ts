// Smoketest: can we authenticate, list parts (products), and read recent changes?
// Read-only. Run from the repo root with `pnpm smoke:rrr`.
import { PART_STATUS, RrrApiError, rrrClientFromEnv, type RrrPart } from "../src/index.ts";

const statusLabel = Object.fromEntries(Object.entries(PART_STATUS).map(([label, code]) => [code, label]));
const line = (p: RrrPart) =>
  `  #${p.id}  ${p.name}  [${p.manufacturer_code || "-"}]  ${p.price} ${
    p.currency
  }  ${statusLabel[p.status] ?? p.status}  updated ${p.updated_at}`;

// RRR timestamps look like Europe/Vilnius local time with no offset; "sv-SE" formats as YYYY-MM-DD HH:mm:ss.
const rrrTimestamp = (d: Date) => d.toLocaleString("sv-SE", { timeZone: "Europe/Vilnius" });

const started = Date.now();

try {
  const client = rrrClientFromEnv();
  const { parts, pagination } = await client.getParts({ page: 1, limit: 5 });

  console.log(`OK in ${Date.now() - started}ms`);
  console.log(`total parts: ${pagination.total_count} (page ${pagination.page}, limit ${pagination.limit})`);
  parts.forEach((p) => console.log(line(p)));

  const since = rrrTimestamp(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const recent: RrrPart[] = [];
  for await (const p of client.iteratePartsUpdatedSince(since)) recent.push(p);

  const byStatus: Record<string, number> = {};
  for (const p of recent)
    byStatus[statusLabel[p.status] ?? p.status] = (byStatus[statusLabel[p.status] ?? p.status] ?? 0) + 1;
  console.log(`\nupdated since ${since}: ${recent.length} parts ${JSON.stringify(byStatus)}`);
  recent.slice(0, 5).forEach((p) => console.log(line(p)));
} catch (err) {
  if (err instanceof RrrApiError) {
    console.error(`FAIL: ${err.message} (http ${err.httpStatus}, status_code ${err.statusCode ?? "-"})`);
  } else {
    console.error(`FAIL: ${err instanceof Error ? err.message : String(err)}`);
  }
  process.exitCode = 1;
}

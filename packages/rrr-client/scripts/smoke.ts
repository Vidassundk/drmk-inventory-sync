// Smoketest: can we authenticate and list parts (products)?
// Read-only. Run from the repo root with `pnpm smoke:rrr`.
import { RrrApiError, rrrClientFromEnv } from "../src/index.ts";

const started = Date.now();

try {
  const client = rrrClientFromEnv();
  const { parts, pagination } = await client.getParts({ page: 1, limit: 5 });

  console.log(`OK in ${Date.now() - started}ms`);
  console.log(`total parts: ${pagination.total_count} (page ${pagination.page}, limit ${pagination.limit})`);
  for (const p of parts) {
    console.log(`  #${p.id}  ${p.name}  [${p.manufacturer_code || "-"}]  ${p.price}  status=${p.status}`);
  }
  if (parts[0]) {
    console.log("\nfirst part, raw:");
    console.dir(parts[0], { depth: null });
  }
} catch (err) {
  if (err instanceof RrrApiError) {
    console.error(`FAIL: ${err.message} (http ${err.httpStatus}, status_code ${err.statusCode ?? "-"})`);
  } else {
    console.error(`FAIL: ${err instanceof Error ? err.message : String(err)}`);
  }
  process.exitCode = 1;
}

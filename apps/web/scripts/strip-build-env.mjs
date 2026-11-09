// Runs between `opennextjs-cloudflare build` and deploy or preview.
//
// OpenNext copies every value from .env files in this app and in the repo root into the Worker bundle
// (.open-next/cloudflare/next-env.mjs). The root .env holds the sync jobs' secrets: database, RRR, R2, Resend. The
// Worker needs none of them, since its settings come from wrangler.jsonc and `wrangler secret put`. So this empties
// that file, then checks no .env value is left anywhere in the build, and stops the deploy if one is.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseEnv } from "node:util";

const build = new URL("../.open-next/", import.meta.url).pathname;
const envModule = join(build, "cloudflare/next-env.mjs");

if (!existsSync(envModule)) {
  console.error(`strip-build-env: ${envModule} is missing. OpenNext may have changed how it bundles .env files.`);
  process.exit(1);
}
writeFileSync(envModule, ["production", "development", "test"].map((mode) => `export const ${mode} = {};\n`).join(""));

// Every secret-looking value from the .env files, to search the build for. Short values are skipped: the RRR
// username is "deremika", which is all over the code.
const secrets = [new URL("../../../.env", import.meta.url).pathname, new URL("../.env", import.meta.url).pathname]
  .filter(existsSync)
  .flatMap((file) => Object.entries(parseEnv(readFileSync(file, "utf8"))))
  .filter(([, value]) => value.length >= 12 && !value.startsWith("http"))
  .map(([key, value]) => ({ key, value }));

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else if (/\.(m?js|json|html|txt|map)$/.test(name)) yield path;
  }
}

const leaks = [];
for (const file of files(build)) {
  const text = readFileSync(file, "utf8");
  for (const { key, value } of secrets) if (text.includes(value)) leaks.push(`${key} in ${file.slice(build.length)}`);
}
if (leaks.length > 0) {
  console.error(`strip-build-env: .env values found in the build, not deploying:\n  ${leaks.join("\n  ")}`);
  process.exit(1);
}
console.log(`strip-build-env: no .env values in the build (checked ${secrets.length}).`);

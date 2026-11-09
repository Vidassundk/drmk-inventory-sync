// Deploys the built Worker to the brand's custom domains, from brand.local/brand.json. They're kept out of
// wrangler.jsonc so the repo names no domain. Run by `pnpm web:deploy`, after the build and strip-build-env.mjs.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const file = new URL("../brand.local/brand.json", import.meta.url);
if (!existsSync(file)) {
  console.error("deploy: apps/web/brand.local/brand.json is missing. Copy brand.example/ to brand.local/ and edit it.");
  process.exit(1);
}
const { domains = [] } = JSON.parse(readFileSync(file, "utf8"));
if (domains.length === 0) {
  console.error("deploy: no domains in brand.local/brand.json, so nothing would serve the Worker.");
  process.exit(1);
}

const args = [
  "opennextjs-cloudflare",
  "deploy",
  "--",
  ...domains.flatMap((domain) => ["--domain", domain]),
  ...process.argv.slice(2),
];
console.log(`deploy: ${domains.join(", ")}`);
execFileSync("npx", args, { stdio: "inherit", cwd: new URL("..", import.meta.url) });

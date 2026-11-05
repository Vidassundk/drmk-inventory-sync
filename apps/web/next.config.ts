import { existsSync } from "node:fs";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";

// Local runs have no Hyperdrive, so they connect straight to the database from the root .env.
const rootEnv = new URL("../../.env", import.meta.url).pathname;
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);
if (process.env.DATABASE_URL) {
  process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE ??= process.env.DATABASE_URL;
}

const nextConfig: NextConfig = {
  transpilePackages: ["@deremika/db"],
  // cacheComponents and partialPrefetching stay off: pages hang in the Cloudflare Workers runtime with them on.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

initOpenNextCloudflareForDev();

import { existsSync } from "node:fs";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

/**
 * `pnpm dev:web` has no Hyperdrive or Worker secrets, so it reads them from the root .env: the database URL, and the
 * sign-in and email settings (see src/lib/env.ts). Only the dev server: the OpenNext build copies whatever is in
 * process.env into the Worker bundle, which put every secret in .env into the deployed code.
 */
function loadRootEnvForDev() {
  const rootEnv = new URL("../../.env", import.meta.url).pathname;
  if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);
  if (process.env.DATABASE_URL) {
    process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE ??= process.env.DATABASE_URL;
  }
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

export default function config(phase: string): NextConfig {
  if (phase === PHASE_DEVELOPMENT_SERVER) loadRootEnvForDev();
  return nextConfig;
}

initOpenNextCloudflareForDev();

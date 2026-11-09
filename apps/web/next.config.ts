import { existsSync, readFileSync } from "node:fs";
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

/**
 * The brand from brand/: name, logo, domains and email sender. Read here and inlined into the code at build time,
 * because a Worker can't read files.
 */
function readBrand(): Record<string, string> {
  const dir = new URL("./brand/", import.meta.url);
  const brand = JSON.parse(readFileSync(new URL("brand.json", dir), "utf8"));
  return {
    BRAND_NAME: brand.name,
    BRAND_LOGO_SVG: brand.logo ? readFileSync(new URL(brand.logo, dir), "utf8") : "",
    BRAND_EMAIL_FROM: brand.emailFrom ?? "",
    BRAND_DOMAINS: JSON.stringify(brand.domains ?? []),
  };
}

const nextConfig: NextConfig = {
  transpilePackages: ["@drmk/db"],
  env: readBrand(),
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

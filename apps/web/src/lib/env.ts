import { getCloudflareContext } from "@opennextjs/cloudflare";

type Setting = "BETTER_AUTH_SECRET" | "RESEND_API_KEY" | "EMAIL_FROM" | "EMAIL_LOG_ONLY";

/** A Worker variable or secret. Local runs also fall back to the root .env, which next.config.ts loads. */
export function serverEnv(name: Setting): string | undefined {
  const { env } = getCloudflareContext();
  return env[name] || process.env[name] || undefined;
}

/** The addresses the dashboard is served from. Links in emails only ever point at one of these. */
export const SITE_ORIGINS = [
  "https://stock.deremika.lt",
  "https://app.vidasstirbys.com",
  "http://localhost:3000",
  "http://localhost:8797",
];

/** The address this request came in on, if it's one of ours; otherwise the main one. */
export function siteOrigin(requestHeaders: Headers) {
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  return SITE_ORIGINS.find((origin) => new URL(origin).host === host) ?? SITE_ORIGINS[0];
}

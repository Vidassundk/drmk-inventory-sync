// The brand, inlined at build time by next.config.ts from brand.local/ (gitignored) or the neutral brand.example/.
// Safe for client components too: none of it is secret.

export const BRAND_NAME = process.env.BRAND_NAME || "drmk";
/** An SVG drawing, or empty for a plain text wordmark. Comes from a file in the repo owner's own brand folder. */
export const BRAND_LOGO_SVG = process.env.BRAND_LOGO_SVG || "";
export const BRAND_EMAIL_FROM = process.env.BRAND_EMAIL_FROM || "";
/** Hostnames the dashboard is served from, such as stock.example.com. */
export const BRAND_DOMAINS: string[] = JSON.parse(process.env.BRAND_DOMAINS || "[]");

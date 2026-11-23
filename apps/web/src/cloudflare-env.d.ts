interface CloudflareEnv {
  HYPERDRIVE: { connectionString: string };
  R2_PUBLIC_BASE_URL: string;
  /** Signs session cookies. A secret: `wrangler secret put BETTER_AUTH_SECRET`. */
  BETTER_AUTH_SECRET?: string;
  /** Sends sign-in and invite emails. A secret: `wrangler secret put RESEND_API_KEY`. Without it, local runs log emails. */
  RESEND_API_KEY?: string;
  /** Overrides the brand's email sender, such as `Shop <sign-in@example.com>`. */
  EMAIL_FROM?: string;
  /** Local `wrangler dev` only: log emails instead of sending them. Never set this on the deployed Worker. */
  EMAIL_LOG_ONLY?: string;
  /** RRR API login, for reserving parts from the dashboard. Secrets, set with `wrangler secret put`. */
  RRR_USERNAME?: string;
  RRR_PASSWORD?: string;
  RRR_USER_TOKEN?: string;
  /** Overrides the RRR API address, such as RRR's staging API. */
  RRR_BASE_URL?: string;
}

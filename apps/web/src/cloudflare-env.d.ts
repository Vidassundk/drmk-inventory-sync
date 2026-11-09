interface CloudflareEnv {
  HYPERDRIVE: { connectionString: string };
  R2_PUBLIC_BASE_URL: string;
  /** Signs session cookies. A secret: `wrangler secret put BETTER_AUTH_SECRET`. */
  BETTER_AUTH_SECRET?: string;
  /** Sends sign-in and invite emails. A secret: `wrangler secret put RESEND_API_KEY`. Without it, local runs log emails. */
  RESEND_API_KEY?: string;
  /** The sender, such as `Deremika <prisijungimas@deremika.lt>`. */
  EMAIL_FROM?: string;
  /** Local `wrangler dev` only: log emails instead of sending them. Never set this on the deployed Worker. */
  EMAIL_LOG_ONLY?: string;
}

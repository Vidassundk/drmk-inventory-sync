import { RrrClient } from "./client.ts";

/** Builds a client from RRR_* env vars, failing fast if any are missing. */
export function rrrClientFromEnv(env: NodeJS.ProcessEnv = process.env): RrrClient {
  const required = ["RRR_USERNAME", "RRR_PASSWORD", "RRR_USER_TOKEN"] as const;
  const missing = required.filter((key) => !env[key]);
  if (missing.length) {
    throw new Error(`Missing env vars: ${missing.join(", ")} (copy .env.example to .env at the repo root)`);
  }
  return new RrrClient({
    baseUrl: env.RRR_BASE_URL || undefined,
    username: env.RRR_USERNAME!,
    password: env.RRR_PASSWORD!,
    userToken: env.RRR_USER_TOKEN!,
  });
}

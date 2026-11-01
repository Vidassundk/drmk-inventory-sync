import { defineConfig } from "drizzle-kit";

process.loadEnvFile?.(new URL("../../.env", import.meta.url).pathname);

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./migrations",
  dbCredentials: { url: process.env.DATABASE_URL! },
  strict: true,
  verbose: true,
});

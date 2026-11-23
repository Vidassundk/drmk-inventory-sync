import { RrrClient } from "@drmk/rrr-client";
import type { PartStatus } from "./parts-query";
import { serverEnv } from "./env";

/** The RRR API, logged in with the Worker's RRR_* secrets. Only reservations use it: everything else reads our copy. */
export function rrrClient() {
  const username = serverEnv("RRR_USERNAME");
  const password = serverEnv("RRR_PASSWORD");
  const userToken = serverEnv("RRR_USER_TOKEN");
  if (!username || !password || !userToken) throw new Error("Missing RRR_USERNAME, RRR_PASSWORD or RRR_USER_TOKEN");
  return new RrrClient({ baseUrl: serverEnv("RRR_BASE_URL"), username, password, userToken });
}

/** RRR's status codes as our status names, the same as the sync's (apps/worker/src/rrr/map.ts). */
const STATUSES: Record<string, PartStatus> = {
  "0": "in_stock",
  "1": "reserved",
  "2": "sold",
  "3": "returned",
  "4": "written_off",
  "7": "stock_audit",
  "8": "template",
};

export const statusFromRrr = (code: string): PartStatus | null => STATUSES[code] ?? null;

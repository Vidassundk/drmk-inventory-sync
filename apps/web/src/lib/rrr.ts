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

/** Marks the lines we write into a part's internal notes on RRR, so we can find and replace them later. */
const OUR_LINE = /^Rezervacija .* iš vidinės platformos$/;

/** Today in Vilnius, as RRR's staff read dates: 2026-11-23. */
const today = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Vilnius" }).format(new Date());

/**
 * The line staff see in RRR's internal notes. It stays in Lithuanian whatever language the admin uses, since it's
 * for the team in RRR. With no client (a reservation made straight on RRR), the line leaves the name out.
 */
export const reservationNote = (action: "sukurta" | "atšaukta", client: string | null) =>
  `Rezervacija ${client ? `${client} ` : ""}${action} ${today()} iš vidinės platformos`;

/**
 * The notes with our line on top and the team's own text kept below it. Any line we wrote earlier is replaced, so
 * notes never pile up. RRR can't empty a note, which is why releasing writes an "atšaukta" line instead of removing ours.
 */
export function withReservationNote(notes: string | null | undefined, line: string) {
  const theirs = (notes ?? "")
    .split("\n")
    .filter((text) => !OUR_LINE.test(text.trim()))
    .join("\n")
    .trim();
  return theirs ? `${line}\n${theirs}` : line;
}

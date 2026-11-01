import { createHash } from "node:crypto";
import type { parts } from "@deremika/db";
import type { RrrPart } from "@deremika/rrr-client";

type PartStatus = (typeof parts.$inferInsert)["status"];

const STATUS: Record<string, PartStatus> = {
  "0": "in_stock",
  "1": "reserved",
  "2": "sold",
  "3": "returned",
  "4": "written_off",
};

const blank = (v: string | null | undefined) => (v == null || v.trim() === "" ? null : v);
const int = (v: unknown) => {
  const n = Number.parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};
// RRR uses "0000-00-00 00:00:00" for "no date".
const naiveTimestamp = (v: string | null | undefined) => (v && !v.startsWith("0000") ? v : null);

/** Our part columns, derived from an RRR part. */
export function partValues(p: RrrPart) {
  const status = STATUS[p.status] ?? "unknown";
  return {
    name: p.name,
    manufacturerCode: blank(p.manufacturer_code),
    visibleCode: blank(p.visible_code),
    otherCode: blank(p.other_code),
    notes: blank(p.notes),
    internalNotes: blank(p.internal_notes),
    price: blank(p.price),
    currency: blank(p.currency),
    quality: p.quality === "" || p.quality == null ? null : Number(p.quality),
    status,
    rrrCategoryId: int(p.category_id),
    rrrCarId: int(p.car_id),
    listedAt: naiveTimestamp(p.date),
  } satisfies Omit<typeof parts.$inferInsert, "id">;
}

/**
 * Ovoko serves each photo under a random watermark corner (".../tl/1024x768/...",
 * "tr", "bl", "br") that changes on every request; without that segment it
 * serves the clean original. Canonicalize to the clean URL so photos have a
 * stable identity and our payload hash only changes when the data does.
 */
export function canonicalPhotoUrl(url: string) {
  return url.replace(/^(https:\/\/images\.ovoko\.com)\/(?:tl|tr|bl|br)\//, "$1/");
}

// Marketplace badges (e.g. glovebox.ovoko.com/static-photos/france-fulfillment-part.svg), not part photos.
const isPartPhoto = (url: string) => !url.includes("/static-photos/");

export const galleryUrls = (p: RrrPart) => [
  ...new Set((p.part_photo_gallery ?? []).filter(Boolean).filter(isPartPhoto).map(canonicalPhotoUrl)),
];

/** The RRR payload with photo URLs canonicalized; this is what we store and hash. */
export const stablePayload = (p: RrrPart): RrrPart => ({
  ...p,
  photo: p.photo ? canonicalPhotoUrl(p.photo) : p.photo,
  part_photo_gallery: (p.part_photo_gallery ?? []).map(canonicalPhotoUrl),
});

export const contentHash = (p: RrrPart) =>
  createHash("sha256")
    .update(JSON.stringify(stablePayload(p)))
    .digest("hex");

export const externalUpdatedAt = (p: RrrPart) => naiveTimestamp(p.updated_at);

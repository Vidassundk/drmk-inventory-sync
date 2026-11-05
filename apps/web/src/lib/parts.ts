import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq, images, isNull, partImages, parts, sql } from "@deremika/db";
import { getDb } from "./db";

/** Our R2 copy if the photo has been rehosted, otherwise the original on Ovoko. */
export function imageUrl(image: { storageKey: string | null; sourceUrl: string | null }) {
  if (image.storageKey) return `${getCloudflareContext().env.R2_PUBLIC_BASE_URL}/${image.storageKey}`;
  return image.sourceUrl;
}

export async function listInStockParts(limit: number) {
  const rows = await getDb()
    .select({
      id: parts.id,
      name: parts.name,
      manufacturerCode: parts.manufacturerCode,
      price: parts.price,
      currency: parts.currency,
      storageKey: images.storageKey,
      sourceUrl: images.sourceUrl,
    })
    .from(parts)
    .leftJoin(partImages, and(eq(partImages.partId, parts.id), eq(partImages.position, 0)))
    .leftJoin(images, eq(images.id, partImages.imageId))
    .where(and(eq(parts.status, "in_stock"), isNull(parts.deletedAt)))
    // Copied photos first: every Ovoko fallback uses up the viewer's limit of about 100 images an hour.
    .orderBy(sql`${images.storageKey} is null`, sql`${parts.listedAt} desc nulls last`)
    .limit(limit);

  return rows.map(({ storageKey, sourceUrl, ...part }) => ({
    ...part,
    coverUrl: imageUrl({ storageKey, sourceUrl }),
    coverOnR2: Boolean(storageKey),
  }));
}

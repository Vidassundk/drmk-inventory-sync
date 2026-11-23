import {
  and,
  asc,
  authUsers,
  desc,
  eq,
  images,
  isNull,
  partImages,
  partListings,
  parts,
  reservations,
  rrrCarModels,
  rrrCars,
  rrrCategories,
  sql,
  type SQLWrapper,
} from "@drmk/db";
import { getI18n } from "./i18n-server";
import { imageUrl, partName } from "./parts";
import { dataDb, requireAdmin, requireUser } from "./session";

/** Reserved parts with who they're for. A part RRR has reserved but we have no client for has a null clientId. */
async function reservedParts(where?: SQLWrapper) {
  const db = await dataDb();
  const { locale } = await getI18n();
  const rows = await db
    .select({
      id: parts.id,
      rrrId: partListings.externalId,
      name: partName(locale),
      price: parts.price,
      currency: parts.currency,
      rrrCarId: parts.rrrCarId,
      carBrand: rrrCarModels.brand,
      carModel: rrrCarModels.name,
      carYearStart: rrrCarModels.yearStart,
      carYearEnd: rrrCarModels.yearEnd,
      clientId: reservations.userId,
      clientName: authUsers.name,
      clientEmail: authUsers.email,
      // Ours if we reserved it; otherwise when RRR says it was reserved.
      reservedAt: sql<string | null>`coalesce(
        to_char(${reservations.createdAt}, 'YYYY-MM-DD'),
        left(nullif(${partListings.raw}->>'reserved_date', ''), 10)
      )`,
      storageKey: images.storageKey,
      sourceUrl: images.sourceUrl,
      photoCount: sql<number>`(select count(*)::int from ${partImages} where ${partImages.partId} = ${parts.id})`,
    })
    .from(parts)
    .leftJoin(reservations, eq(reservations.partId, parts.id))
    .leftJoin(authUsers, eq(authUsers.id, reservations.userId))
    .leftJoin(partListings, and(eq(partListings.partId, parts.id), eq(partListings.channelId, "rrr")))
    .leftJoin(partImages, and(eq(partImages.partId, parts.id), eq(partImages.position, 0)))
    .leftJoin(images, eq(images.id, partImages.imageId))
    .leftJoin(rrrCars, eq(rrrCars.id, parts.rrrCarId))
    .leftJoin(rrrCarModels, eq(rrrCarModels.id, rrrCars.modelId))
    .leftJoin(rrrCategories, eq(rrrCategories.id, parts.rrrCategoryId))
    .where(and(eq(parts.status, "reserved"), isNull(parts.deletedAt), where))
    .orderBy(desc(sql`coalesce(${reservations.createdAt}, ${parts.updatedAt})`), asc(parts.id));

  return rows.map(({ storageKey, sourceUrl, ...part }) => ({ ...part, coverUrl: imageUrl({ storageKey, sourceUrl }) }));
}

export type ReservedPart = Awaited<ReturnType<typeof reservedParts>>[number];

export type ReservationGroup = {
  /** Null for "no client yet". */
  clientId: string | null;
  clientName: string | null;
  clientEmail: string | null;
  parts: ReservedPart[];
  total: number;
};

/** For admins: every reserved part, grouped by client, with "no client yet" first so it gets dealt with. */
export async function listReservationGroups(): Promise<ReservationGroup[]> {
  await requireAdmin();
  const groups = new Map<string | null, ReservationGroup>();
  for (const part of await reservedParts()) {
    const group = groups.get(part.clientId) ?? {
      clientId: part.clientId,
      clientName: part.clientName,
      clientEmail: part.clientEmail,
      parts: [],
      total: 0,
    };
    group.parts.push(part);
    group.total += Number(part.price ?? 0);
    groups.set(part.clientId, group);
  }
  return [...groups.values()].sort((a, b) =>
    a.clientId === null ? -1 : b.clientId === null ? 1 : (a.clientName ?? "").localeCompare(b.clientName ?? ""),
  );
}

/** For guests: the parts reserved for them, and nobody else's. */
export async function listMyReservations() {
  const session = await requireUser();
  return reservedParts(eq(reservations.userId, session.user.id));
}

/** Who a reserved part is for, for the part page. Admins only. */
export async function reservationFor(partId: string) {
  await requireAdmin();
  const db = await dataDb();
  const [row] = await db
    .select({ clientId: reservations.userId })
    .from(reservations)
    .where(eq(reservations.partId, partId));
  return row?.clientId ?? null;
}

/** People parts can be reserved for: every guest, by name. Admins only. */
export async function listClients() {
  await requireAdmin();
  const db = await dataDb();
  return db
    .select({ id: authUsers.id, name: authUsers.name, email: authUsers.email })
    .from(authUsers)
    .where(eq(authUsers.role, "member"))
    .orderBy(asc(authUsers.name));
}

export type Client = Awaited<ReturnType<typeof listClients>>[number];

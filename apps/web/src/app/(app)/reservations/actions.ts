"use server";

import { revalidatePath } from "next/cache";
import { and, authUsers, eq, isNull, partListings, parts, reservations } from "@drmk/db";
import { getDb } from "@/lib/db";
import type { MessageKey } from "@/lib/i18n";
import type { PartStatus } from "@/lib/parts-query";
import { rrrClient, statusFromRrr } from "@/lib/rrr";
import { requireAdmin } from "@/lib/session";

export type ReservationResult = { ok?: MessageKey; error?: MessageKey; status?: PartStatus };

/** Our part and its RRR id, if it's still listed. */
async function findPart(partId: string) {
  const [part] = await getDb()
    .select({ id: parts.id, rrrId: partListings.externalId })
    .from(parts)
    .innerJoin(partListings, and(eq(partListings.partId, parts.id), eq(partListings.channelId, "rrr")))
    .where(and(eq(parts.id, partId), isNull(parts.deletedAt)));
  return part ?? null;
}

/**
 * The quick one-part sync: asks RRR for the part's status right now and saves it, so we never act on a stale copy.
 * Returns the status, or null if RRR doesn't have the part.
 */
async function freshStatus(part: { id: string; rrrId: string }) {
  const snapshot = await rrrClient().getPart(part.rrrId);
  const status = snapshot ? statusFromRrr(snapshot.status) : null;
  if (status) await getDb().update(parts).set({ status }).where(eq(parts.id, part.id));
  return status;
}

function refresh(partId: string) {
  revalidatePath("/reservations");
  revalidatePath("/parts");
  revalidatePath(`/parts/${partId}`);
}

/**
 * Sets a part aside for a guest. If it's in stock, reserves it on RRR first; if RRR already has it reserved (say,
 * reserved there by staff), just records who it's for. Anything else, such as sold, is refused.
 */
export async function reservePart(partId: string, clientId: string): Promise<ReservationResult> {
  const session = await requireAdmin();
  const db = getDb();
  const part = await findPart(partId);
  if (!part) return { error: "reservations.notFound" };
  const [client] = await db.select({ id: authUsers.id }).from(authUsers).where(eq(authUsers.id, clientId));
  if (!client) return { error: "reservations.clientMissing" };

  try {
    const status = await freshStatus(part);
    if (status === "in_stock") {
      await rrrClient().changePartStatus(part.rrrId, "1");
    } else if (status !== "reserved") {
      refresh(partId);
      return { error: "reservations.notAvailable", status: status ?? undefined };
    }
  } catch (error) {
    console.error("RRR reservation failed", error);
    return { error: "reservations.rrrFailed" };
  }

  // RRR has it reserved now. If saving this fails, the part still shows up under "no client yet", so it isn't lost.
  await db.transaction(async (tx) => {
    await tx.update(parts).set({ status: "reserved" }).where(eq(parts.id, partId));
    await tx
      .insert(reservations)
      .values({ partId, userId: clientId, reservedBy: session.user.id })
      .onConflictDoUpdate({ target: reservations.partId, set: { userId: clientId, reservedBy: session.user.id } });
  });
  refresh(partId);
  return { ok: "reservations.reserved" };
}

/** Puts a part back in stock on RRR and takes it off its list. If RRR no longer has it reserved, only tidies up here. */
export async function releasePart(partId: string): Promise<ReservationResult> {
  await requireAdmin();
  const db = getDb();
  const part = await findPart(partId);
  if (!part) return { error: "reservations.notFound" };

  let status: PartStatus | null;
  try {
    status = await freshStatus(part);
    if (status === "reserved") {
      await rrrClient().changePartStatus(part.rrrId, "0");
      status = "in_stock";
      await db.update(parts).set({ status }).where(eq(parts.id, partId));
    }
  } catch (error) {
    console.error("RRR release failed", error);
    return { error: "reservations.rrrFailed" };
  }

  await db.delete(reservations).where(eq(reservations.partId, partId));
  refresh(partId);
  return status === "in_stock"
    ? { ok: "reservations.released" }
    : { ok: "reservations.alreadyEnded", status: status ?? undefined };
}

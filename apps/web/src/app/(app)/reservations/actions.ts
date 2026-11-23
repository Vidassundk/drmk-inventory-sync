"use server";

import { revalidatePath } from "next/cache";
import { and, authUsers, eq, isNull, partListings, parts, reservations } from "@drmk/db";
import { getDb } from "@/lib/db";
import type { MessageKey } from "@/lib/i18n";
import type { PartStatus } from "@/lib/parts-query";
import { reservationNote, rrrClient, statusFromRrr, withReservationNote } from "@/lib/rrr";
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
 * The quick one-part sync: asks RRR for the part's status and internal notes right now and saves the status, so we
 * never act on a stale copy. The status is null if RRR doesn't have the part.
 */
async function freshPart(part: { id: string; rrrId: string }) {
  const snapshot = await rrrClient().getPart(part.rrrId);
  const status = snapshot ? statusFromRrr(snapshot.status) : null;
  if (status) await getDb().update(parts).set({ status }).where(eq(parts.id, part.id));
  return { status, notes: typeof snapshot?.internal_notes === "string" ? snapshot.internal_notes : "" };
}

/**
 * Writes who the reservation is for into the part's internal notes on RRR, for staff working there. Best effort:
 * the reservation itself is already done, so a failure here is logged rather than undoing it.
 */
async function writeNote(part: { id: string; rrrId: string }, notes: string, line: string) {
  const text = withReservationNote(notes, line);
  try {
    await rrrClient().setInternalNotes(part.rrrId, text);
    await getDb().update(parts).set({ internalNotes: text }).where(eq(parts.id, part.id));
  } catch (error) {
    console.error("RRR internal notes failed", error);
  }
}

async function clientName(userId: string | null | undefined) {
  if (!userId) return null;
  const [user] = await getDb().select({ name: authUsers.name }).from(authUsers).where(eq(authUsers.id, userId));
  return user?.name ?? null;
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
  const [client] = await db
    .select({ id: authUsers.id, name: authUsers.name })
    .from(authUsers)
    .where(eq(authUsers.id, clientId));
  if (!client) return { error: "reservations.clientMissing" };

  let notes: string;
  try {
    const fresh = await freshPart(part);
    const status = fresh.status;
    notes = fresh.notes;
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
  await writeNote(part, notes, reservationNote("sukurta", client.name));
  refresh(partId);
  return { ok: "reservations.reserved" };
}

/** Puts a part back in stock on RRR and takes it off its list. If RRR no longer has it reserved, only tidies up here. */
export async function releasePart(partId: string): Promise<ReservationResult> {
  await requireAdmin();
  const db = getDb();
  const part = await findPart(partId);
  if (!part) return { error: "reservations.notFound" };

  const [entry] = await db
    .select({ userId: reservations.userId })
    .from(reservations)
    .where(eq(reservations.partId, partId));
  let status: PartStatus | null;
  let notes: string;
  try {
    ({ status, notes } = await freshPart(part));
    if (status === "reserved") {
      await rrrClient().changePartStatus(part.rrrId, "0");
      status = "in_stock";
      await db.update(parts).set({ status }).where(eq(parts.id, partId));
      await writeNote(part, notes, reservationNote("atšaukta", await clientName(entry?.userId)));
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

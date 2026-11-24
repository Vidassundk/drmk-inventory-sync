"use server";

import { revalidatePath } from "next/cache";
import { and, authUsers, count, eq, isNull, partListings, parts, reservationRequests, reservations } from "@drmk/db";
import { getDb } from "@/lib/db";
import type { MessageKey } from "@/lib/i18n";
import type { PartStatus } from "@/lib/parts-query";
import { reservationNote, rrrClient, statusFromRrr, withReservationNote } from "@/lib/rrr";
import { isAdmin, requireAdmin, requireUser } from "@/lib/session";

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

// The whole app, not just the pages: the sidebar's request count lives in the layout.
function refresh() {
  revalidatePath("/", "layout");
}

/** At most this many open requests per guest, so a slip of the mouse can't flood the admins' list. */
const MAX_OPEN_REQUESTS = 30;

/**
 * Sets a part aside for a guest. If it's in stock, reserves it on RRR first; if RRR already has it reserved (say,
 * reserved there by staff), just records who it's for. Anything else, such as sold, is refused.
 */
export async function reservePart(partId: string, clientId: string): Promise<ReservationResult> {
  return reserve(partId, clientId, { inStockOnly: false });
}

/**
 * `inStockOnly` is for approving a guest's request: then a part RRR already has reserved is refused, as staff may
 * have set it aside for someone else, instead of being claimed for the guest.
 */
async function reserve(
  partId: string,
  clientId: string,
  { inStockOnly }: { inStockOnly: boolean },
): Promise<ReservationResult> {
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
    } else if (status !== "reserved" || inStockOnly) {
      // Nobody can have it now, so requests for it have nothing left to wait for.
      await db.delete(reservationRequests).where(eq(reservationRequests.partId, partId));
      refresh();
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
    // A reserved part is no longer up for requests, whoever it went to.
    await tx.delete(reservationRequests).where(eq(reservationRequests.partId, partId));
  });
  await writeNote(part, notes, reservationNote("sukurta", client.name));
  refresh();
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
  refresh();
  return status === "in_stock"
    ? { ok: "reservations.released" }
    : { ok: "reservations.alreadyEnded", status: status ?? undefined };
}

/**
 * A guest asks for a part in stock to be set aside for them. Changes nothing on RRR: that waits for an admin's
 * approval. Checks our copy of the status only; approving checks RRR.
 */
export async function requestPart(partId: string): Promise<ReservationResult> {
  const session = await requireUser();
  // Admins reserve straight away instead.
  if (isAdmin(session)) return { error: "reservations.notFound" };
  const db = getDb();
  const [part] = await db
    .select({ status: parts.status })
    .from(parts)
    .where(and(eq(parts.id, partId), isNull(parts.deletedAt)));
  if (!part) return { error: "reservations.notFound" };
  if (part.status !== "in_stock") return { error: "reservations.request.notAvailable" };

  const [{ open }] = await db
    .select({ open: count() })
    .from(reservationRequests)
    .where(eq(reservationRequests.userId, session.user.id));
  if (open >= MAX_OPEN_REQUESTS) return { error: "reservations.request.tooMany" };

  await db.insert(reservationRequests).values({ partId, userId: session.user.id }).onConflictDoNothing();
  refresh();
  return { ok: "reservations.request.sentNow" };
}

/** A guest takes back their own request. */
export async function cancelRequest(partId: string): Promise<ReservationResult> {
  const session = await requireUser();
  await getDb()
    .delete(reservationRequests)
    .where(and(eq(reservationRequests.partId, partId), eq(reservationRequests.userId, session.user.id)));
  refresh();
  return { ok: "reservations.request.cancelled" };
}

/** Approves a guest's request: reserves the part for them on RRR, exactly as reserving it by hand would. */
export async function approveRequest(partId: string, userId: string): Promise<ReservationResult> {
  await requireAdmin();
  const db = getDb();
  const [request] = await db
    .select({ partId: reservationRequests.partId })
    .from(reservationRequests)
    .where(and(eq(reservationRequests.partId, partId), eq(reservationRequests.userId, userId)));
  if (!request) {
    refresh();
    return { error: "reservations.requests.gone" };
  }
  const result = await reserve(partId, userId, { inStockOnly: true });
  return result.ok ? { ok: "reservations.requests.approved" } : result;
}

/** Turns a request down. Nothing changes on RRR. */
export async function declineRequest(partId: string, userId: string): Promise<ReservationResult> {
  await requireAdmin();
  await getDb()
    .delete(reservationRequests)
    .where(and(eq(reservationRequests.partId, partId), eq(reservationRequests.userId, userId)));
  refresh();
  return { ok: "reservations.requests.declined" };
}

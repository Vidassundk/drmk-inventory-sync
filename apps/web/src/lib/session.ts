import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import type { Db } from "@deremika/db";
import { getAuth } from "./auth";
import { getDb } from "./db";

/** The signed-in person, or null. */
export const getSession = cache(async () => {
  const auth = await getAuth();
  return auth.api.getSession({ headers: await headers() });
});

/** The signed-in person; anyone else is sent to the sign-in page. */
export const requireUser = cache(async () => {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
});

export const isAdmin = (session: { user: { role?: string | null } }) => session.user.role === "admin";

export async function requireAdmin() {
  const session = await requireUser();
  // Not found rather than forbidden: members don't need to know admin pages exist.
  if (!isAdmin(session)) notFound();
  return session;
}

/**
 * The database, for inventory reads. Every parts and cars query goes through here, so nothing reaches the data
 * without a signed-in user, whether it's a page, its title, or an /api route.
 */
export async function dataDb(): Promise<Db> {
  await requireUser();
  return getDb();
}

"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { authUsers, eq, type UserRole } from "@deremika/db";
import { InviteEmail } from "@/emails/invite-email";
import { getDb } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { siteOrigin } from "@/lib/env";
import { createI18n, LOCALES, type Locale, type MessageKey } from "@/lib/i18n";
import { requireAdmin } from "@/lib/session";

export type InviteState = { ok?: MessageKey; error?: MessageKey } | null;

const ROLES: UserRole[] = ["member", "admin"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function sendInvite(user: { email: string; locale: string }, inviter: string) {
  const i18n = createI18n(LOCALES.find((locale) => locale === user.locale) ?? "lt");
  const link = `${siteOrigin(await headers())}/login#${new URLSearchParams({ email: user.email })}`;
  await sendEmail({
    to: user.email,
    subject: i18n.t("email.invite.subject"),
    body: <InviteEmail i18n={i18n} inviter={inviter} link={link} />,
  });
}

/** Gives someone access and emails them. They become active the first time they sign in. */
export async function inviteUser(_previous: InviteState, form: FormData): Promise<InviteState> {
  const session = await requireAdmin();
  const email = String(form.get("email") ?? "")
    .trim()
    .toLowerCase();
  const name = String(form.get("name") ?? "").trim();
  const role = ROLES.find((value) => value === form.get("role")) ?? "member";
  const locale: Locale = LOCALES.find((value) => value === form.get("locale")) ?? "lt";
  if (!EMAIL.test(email)) return { error: "users.invalidEmail" };

  const [user] = await getDb()
    .insert(authUsers)
    .values({
      id: crypto.randomUUID(),
      email,
      name: name || email.split("@")[0],
      role,
      locale,
      invitedBy: session.user.id,
    })
    .onConflictDoNothing({ target: authUsers.email })
    .returning();
  if (!user) return { error: "users.alreadyInvited" };
  revalidatePath("/users");

  try {
    await sendInvite(user, session.user.name || session.user.email);
  } catch (error) {
    console.error("Invite email failed", error);
    return { error: "users.emailFailed" };
  }
  return { ok: "users.invited" };
}

export async function resendInvite(userId: string) {
  const session = await requireAdmin();
  const [user] = await getDb().select().from(authUsers).where(eq(authUsers.id, userId));
  if (!user || user.emailVerified) return;
  await sendInvite(user, session.user.name || session.user.email);
}

/** Removes the person and their sessions. They're signed out within 5 minutes, when their cookie cache runs out. */
export async function removeUser(userId: string) {
  const session = await requireAdmin();
  if (userId === session.user.id) return;
  await getDb().delete(authUsers).where(eq(authUsers.id, userId));
  revalidatePath("/users");
}

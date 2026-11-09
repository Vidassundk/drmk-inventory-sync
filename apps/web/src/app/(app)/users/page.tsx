import type { Metadata } from "next";
import { authUsers, desc } from "@deremika/db";
import { InviteForm } from "@/components/invite-form";
import { UserActions } from "@/components/user-actions";
import { getDb } from "@/lib/db";
import { getI18n } from "@/lib/i18n-server";
import { requireAdmin } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("users.title") };
}

export default async function UsersPage() {
  const session = await requireAdmin();
  const { t, intlLocale } = await getI18n();
  const users = await getDb()
    .select({
      id: authUsers.id,
      name: authUsers.name,
      email: authUsers.email,
      role: authUsers.role,
      active: authUsers.emailVerified,
      createdAt: authUsers.createdAt,
      lastSignInAt: authUsers.lastSignInAt,
    })
    .from(authUsers)
    .orderBy(desc(authUsers.createdAt));
  const date = new Intl.DateTimeFormat(intlLocale, { dateStyle: "medium" });

  return (
    <main className="flex w-full max-w-5xl flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("users.title")}</h1>
        <p className="text-sm text-muted">{t("users.intro")}</p>
      </div>
      <InviteForm />
      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-xl text-left text-sm">
          <thead className="border-b border-zinc-200 text-xs text-muted dark:border-zinc-800">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">
                {t("users.person")}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {t("users.role")}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {t("users.status")}
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                {t("users.lastSeen")}
              </th>
              <th scope="col" className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-3 py-2.5">
                  <div className="font-medium">{user.name}</div>
                  <div className="text-muted">{user.email}</div>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">{t(`users.roles.${user.role}`)}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs ${user.active ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" : "bg-zinc-100 dark:bg-zinc-900"}`}
                  >
                    {t(user.active ? "users.active" : "users.pending")}
                  </span>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">
                  {user.lastSignInAt ? date.format(user.lastSignInAt) : "–"}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <UserActions
                    userId={user.id}
                    email={user.email}
                    pending={!user.active}
                    self={user.id === session.user.id}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

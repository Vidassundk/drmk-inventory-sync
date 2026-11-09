"use client";

import { useActionState, useEffect, useRef } from "react";
import { inviteUser, type InviteState } from "@/app/(app)/users/actions";
import { useI18n } from "@/components/i18n-provider";
import { Spinner } from "@/components/spinner";
import { LOCALES } from "@/lib/i18n";

const FIELD =
  "rounded-md border border-zinc-300 bg-background px-3 py-2 text-sm font-normal outline-none focus:border-accent focus:ring-1 focus:ring-accent dark:border-zinc-700";
const LANGUAGE_NAMES = { lt: "Lietuvių", en: "English", ru: "Русский" } as const;

export function InviteForm() {
  const { t, locale } = useI18n();
  const [state, invite, pending] = useActionState<InviteState, FormData>(inviteUser, null);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state]);

  return (
    <form
      ref={form}
      action={invite}
      className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
    >
      <h2 className="font-semibold">{t("users.invite")}</h2>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-56 flex-[2] flex-col gap-1.5 text-sm font-medium">
          {t("login.email")}
          <input type="email" name="email" required autoComplete="off" className={FIELD} />
        </label>
        <label className="flex min-w-40 flex-[1.5] flex-col gap-1.5 text-sm font-medium">
          {t("users.name")}
          <input name="name" autoComplete="off" className={FIELD} />
        </label>
        <label className="flex min-w-36 flex-1 flex-col gap-1.5 text-sm font-medium">
          {t("users.role")}
          <select name="role" defaultValue="member" className={FIELD}>
            <option value="member">{t("users.roles.member")}</option>
            <option value="admin">{t("users.roles.admin")}</option>
          </select>
        </label>
        <label className="flex min-w-36 flex-1 flex-col gap-1.5 text-sm font-medium">
          {t("users.language")}
          <select name="locale" defaultValue={locale} className={FIELD}>
            {LOCALES.map((value) => (
              <option key={value} value={value}>
                {LANGUAGE_NAMES[value]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={pending}
          className="flex items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium whitespace-nowrap text-white hover:opacity-90 disabled:opacity-60"
        >
          {t("users.sendInvite")}
          {pending && (
            <Spinner className="size-3.5 border-white/40 border-t-white dark:border-white/40 dark:border-t-white" />
          )}
        </button>
      </div>
      {state?.ok && (
        <p role="status" className="text-sm">
          {t(state.ok)}
        </p>
      )}
      {state?.error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {t(state.error)}
        </p>
      )}
    </form>
  );
}

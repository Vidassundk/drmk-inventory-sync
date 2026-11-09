"use client";

import { useState, useTransition } from "react";
import { removeUser, resendInvite } from "@/app/(app)/users/actions";
import { useI18n } from "@/components/i18n-provider";

const ACTION = "rounded px-2 py-1 text-sm hover:bg-zinc-100 disabled:opacity-60 dark:hover:bg-zinc-900";

/** Resend an invite that hasn't been used yet, or take someone's access away. */
export function UserActions({
  userId,
  email,
  pending,
  self,
}: {
  userId: string;
  email: string;
  pending: boolean;
  self: boolean;
}) {
  const { t } = useI18n();
  const [busy, startTransition] = useTransition();
  const [resent, setResent] = useState(false);

  return (
    <div className="flex justify-end gap-1 whitespace-nowrap">
      {pending && (
        <button
          type="button"
          disabled={busy || resent}
          onClick={() =>
            startTransition(async () => {
              await resendInvite(userId);
              setResent(true);
            })
          }
          className={ACTION}
        >
          {t(resent ? "users.resent" : "users.resend")}
        </button>
      )}
      {!self && (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (window.confirm(t("users.removeConfirm", { email }))) startTransition(() => removeUser(userId));
          }}
          className={`${ACTION} text-red-700 dark:text-red-300`}
        >
          {t("users.remove")}
        </button>
      )}
    </div>
  );
}

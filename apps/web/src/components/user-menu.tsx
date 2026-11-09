"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { useDismiss } from "@/components/filter-ui";
import { useI18n } from "@/components/i18n-provider";
import { UserIcon } from "@/components/icons";
import { Spinner } from "@/components/spinner";
import { authClient } from "@/lib/auth-client";

/** The signed-in email and a sign-out button, behind a person icon in the header. */
export function UserMenu({ email }: { email: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, root);

  async function signOut() {
    setSigningOut(true);
    await authClient.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={t("account.menu")}
        title={email}
        className="grid size-8 place-items-center rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900"
      >
        <UserIcon />
      </button>
      {open && (
        <div className="absolute top-full right-0 z-20 mt-1 w-64 max-w-[calc(100vw-2rem)] rounded-lg border border-zinc-200 bg-background p-1 shadow-lg dark:border-zinc-800">
          <p className="truncate px-3 py-2 text-sm text-muted">{email}</p>
          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-zinc-100 disabled:opacity-60 dark:hover:bg-zinc-900"
          >
            {t("account.signOut")}
            {signingOut && <Spinner className="size-3.5" />}
          </button>
        </div>
      )}
    </div>
  );
}

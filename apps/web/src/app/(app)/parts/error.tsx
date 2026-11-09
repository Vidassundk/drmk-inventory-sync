"use client";

import { useI18n } from "@/components/i18n-provider";

export default function PartsError({ reset }: { reset: () => void }) {
  const { t } = useI18n();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
      <p>{t("parts.loadError")}</p>
      <button onClick={reset} className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700">
        {t("parts.retry")}
      </button>
    </main>
  );
}

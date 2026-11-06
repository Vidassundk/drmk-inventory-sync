"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n-provider";
import { LOCALE_COOKIE, LOCALES, type Locale } from "@/lib/i18n";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function saveLocale(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
}

export function LanguageSwitcher() {
  const router = useRouter();
  const { locale: current, t } = useI18n();
  const [pending, startTransition] = useTransition();

  function choose(locale: Locale) {
    saveLocale(locale);
    startTransition(() => router.refresh());
  }

  return (
    <div role="group" aria-label={t("language.label")} aria-busy={pending} className="flex text-xs">
      {LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          lang={locale}
          onClick={() => choose(locale)}
          aria-pressed={locale === current}
          className="rounded px-1.5 py-1 text-zinc-500 uppercase hover:text-foreground aria-pressed:font-semibold aria-pressed:text-foreground"
        >
          {locale}
        </button>
      ))}
    </div>
  );
}

"use client";

import { addTransitionType, useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n-provider";
import { Spinner } from "@/components/spinner";
import { LOCALE_COOKIE, LOCALES, type Locale } from "@/lib/i18n";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function saveLocale(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
}

export function LanguageSwitcher() {
  const router = useRouter();
  const { locale: current, t } = useI18n();
  const [pending, startTransition] = useTransition();
  // Changing language reloads the page's data, so show the choice straight away rather than after the wait.
  const [shown, setShown] = useOptimistic(current);

  function choose(locale: Locale) {
    saveLocale(locale);
    startTransition(() => {
      addTransitionType("language-change");
      setShown(locale);
      router.refresh();
    });
  }

  return (
    <>
      <div
        role="group"
        aria-label={t("language.label")}
        aria-busy={pending}
        data-language-pending={pending || undefined}
        className="flex text-xs"
      >
        {LOCALES.map((locale) => (
          <button
            key={locale}
            type="button"
            lang={locale}
            onClick={() => choose(locale)}
            aria-pressed={locale === shown}
            className="rounded px-1.5 py-1 text-muted uppercase hover:text-foreground aria-pressed:font-semibold aria-pressed:text-foreground"
          >
            {locale}
          </button>
        ))}
      </div>
      {pending && (
        <div
          role="status"
          aria-label={t("language.changing")}
          className="pointer-events-none fixed inset-0 z-50 grid place-items-center"
        >
          <Spinner className="size-8" />
        </div>
      )}
    </>
  );
}

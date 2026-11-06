"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createI18n, DEFAULT_LOCALE, type I18n, type Locale } from "@/lib/i18n";

const I18nContext = createContext<I18n>(createI18n(DEFAULT_LOCALE));

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const i18n = useMemo(() => createI18n(locale), [locale]);
  return <I18nContext value={i18n}>{children}</I18nContext>;
}

export const useI18n = () => useContext(I18nContext);

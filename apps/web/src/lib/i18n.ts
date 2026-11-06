// Translations live in src/messages, one JSON file per language. lt.json decides which keys exist,
// and a key missing from en.json or ru.json fails the typecheck.
import en from "@/messages/en.json";
import lt from "@/messages/lt.json";
import ru from "@/messages/ru.json";

export const LOCALES = ["lt", "en", "ru"] as const;
export type Locale = (typeof LOCALES)[number];
export type MessageKey = keyof typeof lt;

export const DEFAULT_LOCALE: Locale = "lt";
export const LOCALE_COOKIE = "locale";

const MESSAGES: Record<Locale, Record<MessageKey, string>> = { lt, en, ru };
const INTL_LOCALES: Record<Locale, string> = { lt: "lt-LT", en: "en-GB", ru: "ru-RU" };

export const parseLocale = (value: string | undefined): Locale =>
  LOCALES.find((locale) => locale === value) ?? DEFAULT_LOCALE;

type Values = Record<string, string | number>;

export function createI18n(locale: Locale) {
  const messages = MESSAGES[locale];
  const intlLocale = INTL_LOCALES[locale];
  const plurals = new Intl.PluralRules(intlLocale);

  /** A message with its {placeholders} filled in. */
  const t = (key: MessageKey, values: Values = {}) =>
    messages[key].replace(/\{(\w+)\}/g, (_, name: string) => String(values[name]));

  return {
    locale,
    intlLocale,
    t,
    has: (key: string): key is MessageKey => key in messages,
    /** Picks the right plural form, so "items" gives 1 prekė, 3 prekės, 12 prekių. */
    count: (prefix: "items", count: number) => {
      const form = plurals.select(count);
      const key = `${prefix}.${form === "two" || form === "zero" ? "other" : form}` as MessageKey;
      return t(key, { count });
    },
  };
}

export type I18n = ReturnType<typeof createI18n>;

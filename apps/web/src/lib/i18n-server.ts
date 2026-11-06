import { cache } from "react";
import { cookies } from "next/headers";
import { createI18n, LOCALE_COOKIE, parseLocale } from "./i18n";

/** Translations for this request, using the language saved in the visitor's cookie. */
export const getI18n = cache(async () => createI18n(parseLocale((await cookies()).get(LOCALE_COOKIE)?.value)));

"use client";

import { useEffect, useRef, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/components/i18n-provider";
import { parsePartsQuery, partsHref } from "@/lib/parts-query";

const DEBOUNCE_MS = 300;

/** Lives in the header, so it reads the list's state from the URL and works from any page. */
export function PartsSearch() {
  const router = useRouter();
  const onList = usePathname() === "/parts";
  const query = parsePartsQuery(Object.fromEntries(useSearchParams()));
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  // Follow the URL on back and forward, but never overwrite what someone is typing.
  useEffect(() => {
    if (input.current && document.activeElement !== input.current) input.current.value = query.q;
  }, [query.q]);

  function search(q: string) {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!onList && !q.trim()) return;
      const href = partsHref(query, { q: q.trim(), page: 1 });
      // On the list, replace: typing shouldn't fill the back button with every letter.
      // From another page, push, so back still returns there.
      startTransition(() => (onList ? router.replace(href) : router.push(href)));
    }, DEBOUNCE_MS);
  }

  return (
    <input
      ref={input}
      type="search"
      defaultValue={query.q}
      onChange={(event) => search(event.target.value)}
      placeholder={t("parts.searchPlaceholder")}
      aria-label={t("parts.searchLabel")}
      aria-busy={pending}
      className="h-9 w-full rounded-md border border-zinc-300 bg-transparent px-3 text-sm outline-none focus:border-accent aria-busy:opacity-60 dark:border-zinc-700"
    />
  );
}

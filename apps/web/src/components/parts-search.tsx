"use client";

import { useEffect, useRef, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/components/i18n-provider";
import { carsHref, parseCarsQuery } from "@/lib/cars-query";
import { parsePartsQuery, partsHref } from "@/lib/parts-query";

const DEBOUNCE_MS = 300;

/**
 * Lives in the header, so it reads the list's state from the URL and works from any page. On the cars
 * pages it searches cars; everywhere else it searches parts.
 */
export function PartsSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const onCars = pathname.startsWith("/cars");
  const onList = onCars || pathname === "/parts";
  const params = Object.fromEntries(useSearchParams());
  const hrefWith = (q: string) =>
    onCars ? carsHref(parseCarsQuery(params), { q, page: 1 }) : partsHref(parsePartsQuery(params), { q, page: 1 });
  const currentQ = onCars ? parseCarsQuery(params).q : parsePartsQuery(params).q;
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  // Follow the URL on back and forward, but never overwrite what someone is typing.
  useEffect(() => {
    if (input.current && document.activeElement !== input.current) input.current.value = currentQ;
  }, [currentQ]);

  function search(q: string) {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!onList && !q.trim()) return;
      const href = hrefWith(q.trim());
      // On the list, replace: typing shouldn't fill the back button with every letter.
      // From another page, push, so back still returns there.
      startTransition(() => (onList ? router.replace(href) : router.push(href)));
    }, DEBOUNCE_MS);
  }

  return (
    <div className="relative">
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 fill-none stroke-current stroke-[1.5] text-muted"
        strokeLinecap="round"
      >
        <circle cx="7" cy="7" r="4.5" />
        <path d="m10.5 10.5 3 3" />
      </svg>
      <input
        ref={input}
        type="search"
        defaultValue={currentQ}
        onChange={(event) => search(event.target.value)}
        placeholder={t(onCars ? "cars.searchPlaceholder" : "parts.searchPlaceholder")}
        aria-label={t(onCars ? "cars.searchLabel" : "parts.searchLabel")}
        aria-busy={pending}
        className="h-9 w-full rounded-md border border-zinc-300 bg-transparent pr-3 pl-9 text-sm outline-none focus:border-accent aria-busy:opacity-60 dark:border-zinc-700"
      />
    </div>
  );
}

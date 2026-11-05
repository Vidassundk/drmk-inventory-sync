"use client";

import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { partsHref, type PartsQuery } from "@/lib/parts-query";

const DEBOUNCE_MS = 300;

export function PartsSearch({ query }: { query: PartsQuery }) {
  const router = useRouter();
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
      // Replace, not push: typing shouldn't fill the back button with every letter.
      startTransition(() => router.replace(partsHref(query, { q: q.trim(), page: 1 })));
    }, DEBOUNCE_MS);
  }

  return (
    <input
      ref={input}
      type="search"
      defaultValue={query.q}
      onChange={(event) => search(event.target.value)}
      placeholder="Ieškoti pagal pavadinimą, kodą, automobilį ar ID"
      aria-label="Ieškoti dalių"
      aria-busy={pending}
      className="h-9 w-full max-w-md rounded-md border border-zinc-300 bg-transparent px-3 text-sm outline-none focus:border-blue-600 aria-busy:opacity-60 dark:border-zinc-700"
    />
  );
}

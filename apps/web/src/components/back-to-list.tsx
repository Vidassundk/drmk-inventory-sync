"use client";

import { useRouter } from "next/navigation";

/** Goes back so the list keeps its tab, search and page. Opened directly from a link, it falls back to the list. */
export function BackToList() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? router.back() : router.push("/parts"))}
      className="self-start text-sm text-zinc-500 hover:text-foreground"
    >
      ← Dalys
    </button>
  );
}

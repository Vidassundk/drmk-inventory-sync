import Link from "next/link";
import { PART_TABS, partsHref, type PartsQuery, type PartTab } from "@/lib/parts-query";

export function PartsTabs({ query }: { query: PartsQuery }) {
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-zinc-200 dark:border-zinc-800">
      {(Object.keys(PART_TABS) as PartTab[]).map((tab) => (
        <Link
          key={tab}
          href={partsHref(query, { tab, page: 1 })}
          aria-current={tab === query.tab ? "page" : undefined}
          className="-mb-px border-b-2 border-transparent px-3 py-2 text-sm whitespace-nowrap text-zinc-500 hover:text-foreground aria-[current=page]:border-blue-600 aria-[current=page]:font-medium aria-[current=page]:text-foreground"
        >
          {PART_TABS[tab]}
        </Link>
      ))}
    </nav>
  );
}

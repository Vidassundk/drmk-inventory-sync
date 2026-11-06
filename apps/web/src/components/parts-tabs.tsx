import Link from "next/link";
import { getI18n } from "@/lib/i18n-server";
import { PART_TABS, partsHref, type PartsQuery } from "@/lib/parts-query";

export async function PartsTabs({ query }: { query: PartsQuery }) {
  const { t } = await getI18n();

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-zinc-200 dark:border-zinc-800">
      {PART_TABS.map((tab) => (
        <Link
          key={tab}
          href={partsHref(query, { tab, page: 1 })}
          aria-current={tab === query.tab ? "page" : undefined}
          className="-mb-px border-b-2 border-transparent px-3 py-2 text-sm whitespace-nowrap text-zinc-500 hover:text-foreground aria-[current=page]:border-blue-600 aria-[current=page]:font-medium aria-[current=page]:text-foreground"
        >
          {t(`tabs.${tab}`)}
        </Link>
      ))}
    </nav>
  );
}

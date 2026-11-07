import { AppLink } from "@/components/app-link";
import { getI18n } from "@/lib/i18n-server";
import { activeTab, PART_TABS, tabHref, type PartsQuery } from "@/lib/parts-query";

export async function PartsTabs({ query }: { query: PartsQuery }) {
  const { t } = await getI18n();
  const active = activeTab(query);

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-zinc-200 dark:border-zinc-800">
      {PART_TABS.map((tab) => (
        <AppLink
          key={tab}
          href={tabHref(query, tab)}
          aria-current={tab === active ? "page" : undefined}
          className="-mb-px border-b-2 border-transparent px-3 py-2 text-sm whitespace-nowrap text-zinc-500 hover:text-foreground aria-[current=page]:border-accent aria-[current=page]:font-medium aria-[current=page]:text-foreground"
        >
          {t(`tabs.${tab}`)}
        </AppLink>
      ))}
    </nav>
  );
}

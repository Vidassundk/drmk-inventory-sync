import { Suspense } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AppLink } from "@/components/app-link";
import { PartsFilters } from "@/components/parts-filters";
import { Pagination } from "@/components/pagination";
import { PartsTable } from "@/components/parts-table";
import { PartsTabs } from "@/components/parts-tabs";
import { getI18n } from "@/lib/i18n-server";
import { COLUMNS_COOKIE, parseColumnSettings, visibleColumns, type PartColumnKey } from "@/lib/part-columns";
import { carLabelFor, carModelLabel, listCarBrands, listParts, similarFilterLabel } from "@/lib/parts";
import { parsePartsQuery, partsHref, type PartsQuery } from "@/lib/parts-query";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("parts.title") };
}

async function PartsResults({ query, columns }: { query: PartsQuery; columns: PartColumnKey[] }) {
  const { t } = await getI18n();
  const [{ rows, total }, filterLabel] = await Promise.all([listParts(query), similarFilterLabel(query)]);
  return (
    <>
      {filterLabel && (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded bg-zinc-100 px-2 py-1 dark:bg-zinc-900">{filterLabel}</span>
          <AppLink
            href={partsHref(query, { category: null, model: null, page: 1 })}
            className="text-zinc-500 hover:text-foreground"
          >
            {t("parts.clearFilter")}
          </AppLink>
        </p>
      )}
      <PartsTable rows={rows} columns={columns} />
      <Pagination
        page={query.page}
        pageSize={query.pageSize}
        total={total}
        hrefFor={(changes) => partsHref(query, changes)}
      />
    </>
  );
}

function PartsSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-busy="true">
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-900" />
      ))}
    </div>
  );
}

export default async function PartsPage({ searchParams }: PageProps<"/parts">) {
  const { t } = await getI18n();
  const query = parsePartsQuery(await searchParams);
  // Column choices live in a cookie, so the server renders the right table with no flash of the default one.
  const settings = parseColumnSettings((await cookies()).get(COLUMNS_COOKIE)?.value);
  const [brands, modelLabel, carLabel] = await Promise.all([
    listCarBrands(),
    carModelLabel(query.model),
    carLabelFor(query.car),
  ]);

  // Only the results wait for the database, so the tabs and filters stay put while they load.
  return (
    <main className="flex w-full flex-1 flex-col gap-4 p-4 md:p-6">
      {/* Hidden from view, but it still names the page for screen readers. */}
      <h1 className="sr-only">{t("parts.title")}</h1>
      <PartsTabs query={query} />
      <PartsFilters query={query} brands={brands} modelLabel={modelLabel} carLabel={carLabel} settings={settings} />
      <Suspense key={partsHref(query)} fallback={<PartsSkeleton />}>
        <PartsResults query={query} columns={visibleColumns(settings)} />
      </Suspense>
    </main>
  );
}

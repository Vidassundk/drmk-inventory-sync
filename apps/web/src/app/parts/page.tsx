import { Suspense } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { PartsPagination } from "@/components/parts-pagination";
import { PartsSearch } from "@/components/parts-search";
import { PartsTable } from "@/components/parts-table";
import { PartsTableSettings } from "@/components/parts-table-settings";
import { PartsTabs } from "@/components/parts-tabs";
import { COLUMNS_COOKIE, parseColumnSettings, visibleColumns, type PartColumnKey } from "@/lib/part-columns";
import { listParts, similarFilterLabel } from "@/lib/parts";
import { parsePartsQuery, partsHref, type PartsQuery } from "@/lib/parts-query";

export const metadata: Metadata = { title: "Dalys" };

async function PartsResults({ query, columns }: { query: PartsQuery; columns: PartColumnKey[] }) {
  const [{ rows, total }, filterLabel] = await Promise.all([listParts(query), similarFilterLabel(query)]);
  return (
    <>
      {filterLabel && (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded bg-zinc-100 px-2 py-1 dark:bg-zinc-900">{filterLabel}</span>
          <Link
            href={partsHref(query, { category: null, model: null, page: 1 })}
            className="text-zinc-500 hover:text-foreground"
          >
            Išvalyti filtrą
          </Link>
        </p>
      )}
      <PartsTable rows={rows} columns={columns} />
      <PartsPagination query={query} total={total} />
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
  const query = parsePartsQuery(await searchParams);
  // Column choices live in a cookie, so the server renders the right table with no flash of the default one.
  const settings = parseColumnSettings((await cookies()).get(COLUMNS_COOKIE)?.value);

  // Only the results wait for the database. The search box stays mounted, so it keeps focus while typing.
  return (
    <main className="flex w-full flex-1 flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Dalys</h1>
        <div className="flex w-full max-w-xl items-center gap-2">
          <PartsSearch query={query} />
          <PartsTableSettings settings={settings} />
        </div>
      </div>
      <PartsTabs query={query} />
      <Suspense key={partsHref(query)} fallback={<PartsSkeleton />}>
        <PartsResults query={query} columns={visibleColumns(settings)} />
      </Suspense>
    </main>
  );
}

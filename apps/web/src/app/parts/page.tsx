import { Suspense } from "react";
import type { Metadata } from "next";
import { PartsPagination } from "@/components/parts-pagination";
import { PartsSearch } from "@/components/parts-search";
import { PartsTable } from "@/components/parts-table";
import { PartsTabs } from "@/components/parts-tabs";
import { listParts } from "@/lib/parts";
import { parsePartsQuery, partsHref, type PartsQuery } from "@/lib/parts-query";

export const metadata: Metadata = { title: "Dalys" };

async function PartsResults({ query }: { query: PartsQuery }) {
  const { rows, total } = await listParts(query);
  return (
    <>
      <PartsTable rows={rows} />
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

  // Only the results wait for the database. The search box stays mounted, so it keeps focus while typing.
  return (
    <main className="flex w-full flex-1 flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Dalys</h1>
        <PartsSearch query={query} />
      </div>
      <PartsTabs query={query} />
      <Suspense key={partsHref(query)} fallback={<PartsSkeleton />}>
        <PartsResults query={query} />
      </Suspense>
    </main>
  );
}

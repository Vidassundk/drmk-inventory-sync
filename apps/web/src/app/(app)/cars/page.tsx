import { Suspense } from "react";
import type { Metadata } from "next";
import { CarsFilters } from "@/components/cars-filters";
import { CarsTable } from "@/components/cars-table";
import { Pagination } from "@/components/pagination";
import { carFilterOptions, listCars } from "@/lib/cars";
import { carsHref, parseCarsQuery, type CarsQuery } from "@/lib/cars-query";
import { getI18n } from "@/lib/i18n-server";
import { carModelLabel } from "@/lib/parts";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("cars.title") };
}

async function CarsResults({ query }: { query: CarsQuery }) {
  const { rows, total } = await listCars(query);
  return (
    <>
      <CarsTable rows={rows} />
      <Pagination
        page={query.page}
        pageSize={query.pageSize}
        total={total}
        hrefFor={(changes) => carsHref(query, changes)}
      />
    </>
  );
}

function CarsSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-busy="true">
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-900" />
      ))}
    </div>
  );
}

export default async function CarsPage({ searchParams }: PageProps<"/cars">) {
  const { t } = await getI18n();
  const query = parseCarsQuery(await searchParams);
  const [options, modelLabel] = await Promise.all([carFilterOptions(), carModelLabel(query.model)]);

  return (
    <main className="flex w-full flex-1 flex-col gap-4 p-4 md:p-6">
      <h1 className="text-2xl font-semibold">{t("cars.title")}</h1>
      <CarsFilters query={query} options={options} modelLabel={modelLabel} />
      <Suspense key={carsHref(query)} fallback={<CarsSkeleton />}>
        <CarsResults query={query} />
      </Suspense>
    </main>
  );
}

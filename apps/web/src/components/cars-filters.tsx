"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AddFilterMenu,
  CheckPanel,
  FilterChip,
  ListPanel,
  RemoteOptionsPanel,
  useDismiss,
} from "@/components/filter-ui";
import { useI18n } from "@/components/i18n-provider";
import type { CarFilterOption } from "@/lib/cars";
import { carsHref, clearedCarFiltersHref, hasCarFilters, type CarsQuery } from "@/lib/cars-query";

type Filter = "brand" | "model" | "fuel" | "gearbox";
const FILTERS: Filter[] = ["brand", "model", "fuel", "gearbox"];
const FILTER_LABELS = {
  brand: "filters.brand",
  model: "filters.model",
  fuel: "filters.fuel",
  gearbox: "filters.gearbox",
} as const;

type Props = {
  query: CarsQuery;
  brands: string[];
  fuels: CarFilterOption[];
  gearboxes: CarFilterOption[];
  modelLabel: string | null;
};

const labelsOf = (options: CarFilterOption[], values: string[]) =>
  values.map((value) => options.find((option) => option.value === value)?.label ?? value).join(", ") || undefined;

export function CarsFilters({ query, brands, fuels, gearboxes, modelLabel }: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<Filter | "menu" | null>(null);
  const close = useCallback(() => setOpen(null), []);
  const [, startTransition] = useTransition();
  const [refreshing, startRefresh] = useTransition();
  useDismiss(open !== null, close, root);

  function go(href: string) {
    setOpen(null);
    startTransition(() => router.push(href));
  }

  const apply = (changes: Partial<CarsQuery>) => go(carsHref(query, { ...changes, page: 1 }));
  const toggle = (panel: Filter) => setOpen((current) => (current === panel ? null : panel));
  const labelOf = (options: CarFilterOption[]) => (value: string) =>
    options.find((option) => option.value === value)?.label ?? value;

  return (
    <div ref={root} className="relative flex flex-wrap items-center gap-2">
      {(query.brand !== null || open === "brand") && (
        <FilterChip
          label={t("filters.brand")}
          value={query.brand ?? undefined}
          open={open === "brand"}
          onToggle={() => toggle("brand")}
          onRemove={() => apply({ brand: null })}
        >
          <ListPanel
            options={brands}
            initial={query.brand}
            label={t("filters.brand")}
            // A model from another brand would match nothing, so changing brand clears it.
            onApply={(brand) => apply(brand === query.brand ? { brand } : { brand, model: null })}
            onClear={() => apply({ brand: null })}
          />
        </FilterChip>
      )}
      {(query.model !== null || open === "model") && (
        <FilterChip
          label={t("filters.model")}
          value={modelLabel ?? undefined}
          open={open === "model"}
          onToggle={() => toggle("model")}
          onRemove={() => apply({ model: null })}
        >
          <RemoteOptionsPanel
            url="/api/car-models"
            params={query.brand ? { brand: query.brand } : {}}
            label={t("filters.model")}
            initial={query.model}
            onApply={(model) => apply({ model })}
            onClear={() => apply({ model: null })}
          />
        </FilterChip>
      )}
      {(query.fuels.length > 0 || open === "fuel") && (
        <FilterChip
          label={t("filters.fuel")}
          value={labelsOf(fuels, query.fuels)}
          open={open === "fuel"}
          onToggle={() => toggle("fuel")}
          onRemove={() => apply({ fuels: [] })}
        >
          <CheckPanel
            options={fuels.map((option) => option.value)}
            initial={query.fuels}
            labelOf={labelOf(fuels)}
            onApply={(selected) => apply({ fuels: selected })}
            onClear={() => apply({ fuels: [] })}
          />
        </FilterChip>
      )}
      {(query.gearboxes.length > 0 || open === "gearbox") && (
        <FilterChip
          label={t("filters.gearbox")}
          value={labelsOf(gearboxes, query.gearboxes)}
          open={open === "gearbox"}
          onToggle={() => toggle("gearbox")}
          onRemove={() => apply({ gearboxes: [] })}
        >
          <CheckPanel
            options={gearboxes.map((option) => option.value)}
            initial={query.gearboxes}
            labelOf={labelOf(gearboxes)}
            onApply={(selected) => apply({ gearboxes: selected })}
            onClear={() => apply({ gearboxes: [] })}
          />
        </FilterChip>
      )}
      <div className="md:relative">
        <button
          type="button"
          onClick={() => setOpen((current) => (current === "menu" ? null : "menu"))}
          aria-expanded={open === "menu"}
          className="px-2 py-1 text-sm text-accent-text hover:underline"
        >
          + {t("filters.add")}
        </button>
        {open === "menu" && (
          <AddFilterMenu items={FILTERS.map((key) => ({ key, label: t(FILTER_LABELS[key]) }))} onChoose={setOpen} />
        )}
      </div>
      <div className="ml-auto flex items-center gap-2">
        {hasCarFilters(query) && (
          <button
            type="button"
            onClick={() => go(clearedCarFiltersHref(query))}
            className="rounded-md border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            {t("filters.clearAll")}
          </button>
        )}
        <button
          type="button"
          onClick={() => startRefresh(() => router.refresh())}
          disabled={refreshing}
          aria-label={t("filters.refresh")}
          title={t("filters.refresh")}
          className="grid size-8 place-items-center rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900"
        >
          <svg
            viewBox="0 0 16 16"
            aria-hidden="true"
            className={`size-4 fill-none stroke-current stroke-[1.5] ${refreshing ? "animate-spin" : ""}`}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M13.5 8A5.5 5.5 0 0 1 3.6 11.3M2.5 8a5.5 5.5 0 0 1 9.9-3.3" />
            <path d="M12.5 2v2.8H9.7M3.5 14v-2.8h2.8" />
          </svg>
        </button>
      </div>
    </div>
  );
}

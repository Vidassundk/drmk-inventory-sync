"use client";

import { useCallback, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  AddFilterMenu,
  CheckPanel,
  FilterChip,
  ListPanel,
  PANEL,
  PanelFooter,
  RemoteOptionsPanel,
  useDismiss,
} from "@/components/filter-ui";
import { useI18n } from "@/components/i18n-provider";
import { PartsTableSettings } from "@/components/parts-table-settings";
import type { ColumnSettings } from "@/lib/part-columns";
import { qualityLabel, statusLabel } from "@/lib/part-format";
import {
  clearedFiltersHref,
  hasFilters,
  PART_QUALITIES,
  PART_STATUSES,
  partsHref,
  type PartsQuery,
} from "@/lib/parts-query";

type Filter = "status" | "price" | "brand" | "model" | "car" | "code" | "quality";
type Apply = (changes: Partial<PartsQuery>) => void;

const FILTERS: Filter[] = ["status", "price", "brand", "model", "car", "code", "quality"];
const FILTER_LABELS = {
  status: "columns.status",
  price: "columns.price",
  brand: "filters.brand",
  model: "filters.model",
  car: "filters.car",
  code: "filters.code",
  quality: "columns.quality",
} as const;
function CodePanel({ query, apply }: { query: PartsQuery; apply: Apply }) {
  const { t } = useI18n();
  const [code, setCode] = useState(query.code);

  function submit(event: FormEvent) {
    event.preventDefault();
    apply({ code });
  }

  return (
    <form onSubmit={submit} className={PANEL}>
      <div className="flex flex-col gap-1 p-3">
        {(["with", "without"] as const).map((option) => (
          <label key={option} className="flex items-center gap-2 py-1 text-sm">
            <input type="radio" name="part-code" checked={code === option} onChange={() => setCode(option)} />
            {t(`filters.code.${option}`)}
          </label>
        ))}
      </div>
      <PanelFooter onClear={() => apply({ code: null })} />
    </form>
  );
}

const priceValue = (text: string) => {
  const price = Number(text.replace(",", "."));
  return text.trim() !== "" && Number.isFinite(price) && price >= 0 ? price : null;
};

function PriceInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex h-9 min-w-0 flex-1 items-center gap-1.5 rounded-md border border-zinc-300 px-2 text-sm focus-within:border-accent dark:border-zinc-700">
      <span className="text-muted">€</span>
      <input
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={label}
        aria-label={label}
        className="w-full min-w-0 bg-transparent outline-none"
      />
    </label>
  );
}

function PricePanel({ query, apply }: { query: PartsQuery; apply: Apply }) {
  const { t } = useI18n();
  const [noPrice, setNoPrice] = useState(query.noPrice);
  const [min, setMin] = useState(query.priceMin?.toString() ?? "");
  const [max, setMax] = useState(query.priceMax?.toString() ?? "");

  function submit(event: FormEvent) {
    event.preventDefault();
    const [low, high] = [priceValue(min), priceValue(max)];
    const swapped = low !== null && high !== null && low > high;
    apply({
      noPrice,
      priceMin: noPrice ? null : swapped ? high : low,
      priceMax: noPrice ? null : swapped ? low : high,
    });
  }

  return (
    <form onSubmit={submit} className={PANEL}>
      <div className="flex flex-col gap-3 p-3">
        <div className="flex items-center gap-2">
          <input
            type="radio"
            name="price-mode"
            checked={!noPrice}
            onChange={() => setNoPrice(false)}
            aria-label={t("columns.price")}
          />
          <PriceInput label={t("filters.min")} value={min} onChange={(value) => (setMin(value), setNoPrice(false))} />
          <span className="text-muted">–</span>
          <PriceInput label={t("filters.max")} value={max} onChange={(value) => (setMax(value), setNoPrice(false))} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="price-mode" checked={noPrice} onChange={() => setNoPrice(true)} />
          {t("tabs.noPrice")}
        </label>
      </div>
      <PanelFooter onClear={() => apply({ noPrice: false, priceMin: null, priceMax: null })} />
    </form>
  );
}

function priceSummary({ priceMin, priceMax, noPrice }: PartsQuery, noPriceLabel: string) {
  if (noPrice) return noPriceLabel;
  if (priceMin !== null && priceMax !== null) return `${priceMin}–${priceMax} €`;
  if (priceMin !== null) return `≥ ${priceMin} €`;
  if (priceMax !== null) return `≤ ${priceMax} €`;
  return undefined;
}

type FiltersProps = {
  query: PartsQuery;
  brands: string[];
  modelLabel: string | null;
  carLabel: string | null;
  settings: ColumnSettings;
};

export function PartsFilters({ query, brands, modelLabel, carLabel, settings }: FiltersProps) {
  const i18n = useI18n();
  const { t } = i18n;
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

  const refresh = () => startRefresh(() => router.refresh());
  const apply: Apply = (changes) => go(partsHref(query, { ...changes, page: 1 }));
  const toggle = (panel: Filter) => setOpen((current) => (current === panel ? null : panel));

  const statusValue = query.statuses.map((status) => statusLabel(i18n, status)).join(", ");
  const priceValueText = priceSummary(query, t("tabs.noPrice"));
  const showStatus = query.statuses.length > 0 || open === "status";
  const showPrice = priceValueText !== undefined || open === "price";
  const showBrand = query.brand !== null || open === "brand";
  // With a category too, this came from a "Sandėlyje" link, which has its own label above the table.
  const showModel = (query.model !== null && query.category === null) || open === "model";
  const showCar = query.car !== null || open === "car";
  const showCode = query.code !== null || open === "code";
  const showQuality = query.qualities.length > 0 || open === "quality";
  const brandParam: Record<string, string> = query.brand ? { brand: query.brand } : {};

  return (
    <div ref={root} className="relative flex flex-wrap items-center gap-2">
      {showStatus && (
        <FilterChip
          label={t("columns.status")}
          value={statusValue}
          open={open === "status"}
          onToggle={() => toggle("status")}
          onRemove={() => apply({ statuses: [] })}
        >
          <CheckPanel
            options={PART_STATUSES}
            initial={query.statuses}
            labelOf={(status) => statusLabel(i18n, status)}
            onApply={(statuses) => apply({ statuses })}
            onClear={() => apply({ statuses: [] })}
          />
        </FilterChip>
      )}
      {showPrice && (
        <FilterChip
          label={t("columns.price")}
          value={priceValueText}
          open={open === "price"}
          onToggle={() => toggle("price")}
          onRemove={() => apply({ noPrice: false, priceMin: null, priceMax: null })}
        >
          <PricePanel query={query} apply={apply} />
        </FilterChip>
      )}
      {showBrand && (
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
            // A model or car from another brand would match nothing, so changing brand clears them.
            onApply={(brand) => apply(brand === query.brand ? { brand } : { brand, model: null, car: null })}
            onClear={() => apply({ brand: null })}
          />
        </FilterChip>
      )}
      {showModel && (
        <FilterChip
          label={t("filters.model")}
          value={modelLabel ?? undefined}
          open={open === "model"}
          onToggle={() => toggle("model")}
          onRemove={() => apply({ model: null })}
        >
          <RemoteOptionsPanel
            url="/api/car-models"
            params={brandParam}
            label={t("filters.model")}
            initial={query.model}
            onApply={(model) => apply({ model, category: null, car: null })}
            onClear={() => apply({ model: null, category: null })}
          />
        </FilterChip>
      )}
      {showCar && (
        <FilterChip
          label={t("filters.car")}
          value={carLabel ?? undefined}
          open={open === "car"}
          onToggle={() => toggle("car")}
          onRemove={() => apply({ car: null })}
        >
          <RemoteOptionsPanel
            url="/api/cars"
            params={{ ...brandParam, ...(query.model ? { model: String(query.model) } : {}) }}
            label={t("filters.car")}
            initial={query.car}
            onApply={(car) => apply({ car })}
            onClear={() => apply({ car: null })}
          />
        </FilterChip>
      )}
      {showCode && (
        <FilterChip
          label={t("filters.code")}
          value={query.code ? t(`filters.code.${query.code}`) : undefined}
          open={open === "code"}
          onToggle={() => toggle("code")}
          onRemove={() => apply({ code: null })}
        >
          <CodePanel query={query} apply={apply} />
        </FilterChip>
      )}
      {showQuality && (
        <FilterChip
          label={t("columns.quality")}
          value={query.qualities.map((quality) => qualityLabel(i18n, quality)).join(", ") || undefined}
          open={open === "quality"}
          onToggle={() => toggle("quality")}
          onRemove={() => apply({ qualities: [] })}
        >
          <CheckPanel
            options={PART_QUALITIES}
            initial={query.qualities}
            labelOf={(quality) => qualityLabel(i18n, quality)}
            onApply={(qualities) => apply({ qualities })}
            onClear={() => apply({ qualities: [] })}
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
        {hasFilters(query) && (
          <button
            type="button"
            onClick={() => go(clearedFiltersHref(query))}
            className="rounded-md border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            {t("filters.clearAll")}
          </button>
        )}
        <PartsTableSettings settings={settings} />
        <button
          type="button"
          onClick={refresh}
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

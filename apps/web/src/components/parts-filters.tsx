"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
  type UIEvent,
} from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n-provider";
import { Spinner } from "@/components/spinner";
import { statusLabel } from "@/lib/part-format";
import {
  clearedFiltersHref,
  hasFilters,
  OPTIONS_PAGE_SIZE,
  PART_STATUSES,
  partsHref,
  type PartsQuery,
  type PartStatus,
} from "@/lib/parts-query";

type Filter = "status" | "price" | "brand" | "model" | "car";
type Apply = (changes: Partial<PartsQuery>) => void;

const FILTERS: Filter[] = ["status", "price", "brand", "model", "car"];
const FILTER_LABELS = {
  status: "columns.status",
  price: "columns.price",
  brand: "filters.brand",
  model: "filters.model",
  car: "filters.car",
} as const;
const SEARCH_DELAY_MS = 200;
const LOAD_MORE_DISTANCE_PX = 200;
// Panels sit under their chip, but under the whole row on phones, where a chip near the edge would push them off-screen.
const PANEL =
  "absolute top-full left-0 z-20 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-zinc-200 bg-background shadow-lg dark:border-zinc-800";

function PanelFooter({ onClear }: { onClear: () => void }) {
  const { t } = useI18n();

  return (
    <div className="flex items-center justify-between border-t border-zinc-200 px-3 py-2 dark:border-zinc-800">
      <button type="button" onClick={onClear} className="text-sm text-accent-text hover:underline">
        {t("parts.clearFilter")}
      </button>
      <button
        type="submit"
        className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
      >
        {t("filters.apply")}
      </button>
    </div>
  );
}

function StatusPanel({ query, apply }: { query: PartsQuery; apply: Apply }) {
  const i18n = useI18n();
  const [selected, setSelected] = useState(query.statuses);

  function toggle(status: PartStatus) {
    setSelected((current) =>
      current.includes(status) ? current.filter((other) => other !== status) : [...current, status],
    );
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    apply({ statuses: PART_STATUSES.filter((status) => selected.includes(status)) });
  }

  return (
    <form onSubmit={submit} className={PANEL}>
      <div className="flex flex-col gap-1 p-3">
        {PART_STATUSES.map((status) => (
          <label key={status} className="flex items-center gap-2 py-1 text-sm">
            <input type="checkbox" checked={selected.includes(status)} onChange={() => toggle(status)} />
            {statusLabel(i18n, status)}
          </label>
        ))}
      </div>
      <PanelFooter onClear={() => apply({ statuses: [] })} />
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
      <span className="text-zinc-500">€</span>
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
          <span className="text-zinc-500">–</span>
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

function BrandPanel({ query, brands, apply }: { query: PartsQuery; brands: string[]; apply: Apply }) {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(query.brand);
  const term = search.trim().toLowerCase();
  const shown = brands.filter((brand) => brand.toLowerCase().includes(term));

  function submit(event: FormEvent) {
    event.preventDefault();
    // Typing then pressing Enter means the top match, unless a brand that's still listed was clicked.
    const clicked = selected && shown.includes(selected) ? selected : null;
    const brand = clicked ?? (term ? (shown[0] ?? null) : selected);
    // A model or car from another brand would match nothing, so changing brand clears them.
    apply(brand === query.brand ? { brand } : { brand, model: null, car: null });
  }

  return (
    <form onSubmit={submit} className={PANEL}>
      <div className="p-2">
        <input
          type="search"
          autoFocus
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("filters.chooseOption")}
          aria-label={t("filters.brand")}
          className="h-9 w-full rounded-md border border-zinc-300 bg-transparent px-3 text-sm outline-none focus:border-accent dark:border-zinc-700"
        />
      </div>
      <ul className="max-h-80 overflow-y-auto">
        {shown.map((brand) => (
          <li key={brand}>
            <button
              type="button"
              onClick={() => setSelected(brand)}
              aria-pressed={brand === selected}
              className="w-full px-3 py-1.5 text-left text-sm hover:bg-zinc-100 aria-pressed:bg-zinc-100 aria-pressed:font-medium aria-pressed:text-accent-text dark:hover:bg-zinc-900 dark:aria-pressed:bg-zinc-900"
            >
              {brand}
            </button>
          </li>
        ))}
        {shown.length === 0 && <li className="px-3 py-2 text-sm text-zinc-500">{t("filters.noOptions")}</li>}
      </ul>
      <PanelFooter onClear={() => apply({ brand: null })} />
    </form>
  );
}

type RemoteOption = { id: number; label: string };

type RemotePanelProps = {
  /** The endpoint to load options from, which takes `q` and `offset` on top of these params. */
  url: string;
  params: Record<string, string>;
  label: string;
  initial: number | null;
  onApply: (id: number | null) => void;
  onClear: () => void;
};

/** A searchable list too long to send with the page, so it loads a page at a time as it scrolls. */
function RemoteOptionsPanel({ url, params, label, initial, onApply, onClear }: RemotePanelProps) {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<RemoteOption[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [selected, setSelected] = useState(initial);
  const request = useRef<AbortController>(undefined);
  const paramsKey = new URLSearchParams(params).toString();
  // Which search the list shows, so anything else means a new one is on its way.
  const searchKey = `${paramsKey}|${search.trim()}`;
  const searching = loadedFor !== searchKey;

  const load = useCallback(
    async (offset: number) => {
      // A new search replaces whatever was still loading, so old results can't land on top of it.
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      const query = new URLSearchParams(paramsKey);
      query.set("q", search.trim());
      query.set("offset", String(offset));
      try {
        const response = await fetch(`${url}?${query}`, { signal: controller.signal });
        const page: RemoteOption[] = await response.json();
        setOptions((current) => (offset === 0 ? page : [...(current ?? []), ...page]));
        setHasMore(page.length === OPTIONS_PAGE_SIZE);
        setLoadingMore(false);
        setLoadedFor(searchKey);
      } catch (error) {
        if (!controller.signal.aborted) throw error;
      }
    },
    [url, paramsKey, search, searchKey],
  );

  useEffect(() => {
    const timer = setTimeout(() => load(0), SEARCH_DELAY_MS);
    return () => {
      clearTimeout(timer);
      request.current?.abort();
    };
  }, [load]);

  function loadMoreNearBottom(event: UIEvent<HTMLUListElement>) {
    const { scrollTop, clientHeight, scrollHeight } = event.currentTarget;
    if (!hasMore || loadingMore || searching || scrollHeight - scrollTop - clientHeight > LOAD_MORE_DISTANCE_PX) return;
    setLoadingMore(true);
    load(options?.length ?? 0);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    // Typing then pressing Enter means the top match, unless an option that's still listed was clicked.
    const listed = options?.some((option) => option.id === selected);
    onApply(listed || !search.trim() ? selected : (options?.[0]?.id ?? null));
  }

  return (
    <form onSubmit={submit} className={PANEL}>
      <div className="p-2">
        <input
          type="search"
          autoFocus
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("filters.chooseOption")}
          aria-label={label}
          className="h-9 w-full rounded-md border border-zinc-300 bg-transparent px-3 text-sm outline-none focus:border-accent dark:border-zinc-700"
        />
      </div>
      <ul onScroll={loadMoreNearBottom} className="max-h-80 min-h-10 overflow-y-auto">
        {!searching &&
          options?.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => setSelected(option.id)}
                aria-pressed={option.id === selected}
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-zinc-100 aria-pressed:bg-zinc-100 aria-pressed:font-medium aria-pressed:text-accent-text dark:hover:bg-zinc-900 dark:aria-pressed:bg-zinc-900"
              >
                {option.label}
              </button>
            </li>
          ))}
        {!searching && options?.length === 0 && (
          <li className="px-3 py-2 text-sm text-zinc-500">{t("filters.noOptions")}</li>
        )}
        {(searching || loadingMore) && (
          <li role="status" aria-label={t("filters.loading")} className="grid place-items-center py-3">
            <Spinner className="size-5" />
          </li>
        )}
      </ul>
      <PanelFooter onClear={onClear} />
    </form>
  );
}

function AddFilterMenu({ onChoose }: { onChoose: (filter: Filter) => void }) {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const term = search.trim().toLowerCase();
  const shown = FILTERS.filter((filter) => t(FILTER_LABELS[filter]).toLowerCase().includes(term));

  return (
    <div className={PANEL}>
      <div className="p-2">
        <input
          type="search"
          autoFocus
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("filters.search")}
          aria-label={t("filters.searchLabel")}
          className="h-9 w-full rounded-md border border-zinc-300 bg-transparent px-3 text-sm outline-none focus:border-accent dark:border-zinc-700"
        />
      </div>
      <ul className="pb-1">
        {shown.map((filter) => (
          <li key={filter}>
            <button
              type="button"
              onClick={() => onChoose(filter)}
              className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900"
            >
              {t(FILTER_LABELS[filter])}
              <span aria-hidden="true" className="text-zinc-400">
                ›
              </span>
            </button>
          </li>
        ))}
        {shown.length === 0 && <li className="px-3 py-2 text-sm text-zinc-500">{t("filters.noMatches")}</li>}
      </ul>
    </div>
  );
}

type ChipProps = {
  label: string;
  value?: string;
  open: boolean;
  onToggle: () => void;
  onRemove: () => void;
  children: ReactNode;
};

function FilterChip({ label, value, open, onToggle, onRemove, children }: ChipProps) {
  const { t } = useI18n();

  return (
    <div className="md:relative">
      <div className="flex items-center rounded-full bg-zinc-100 text-sm dark:bg-zinc-900">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex items-center gap-1.5 py-1 pr-1 pl-3"
        >
          <span className="font-medium">
            {label}
            {value && ":"}
          </span>
          {value && <span className="max-w-64 truncate">{value}</span>}
          <span aria-hidden="true" className={`text-xs text-zinc-500 ${open ? "rotate-180" : ""}`}>
            ▾
          </span>
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label={t("filters.remove", { filter: label })}
          className="rounded-full px-2 py-1 text-zinc-500 hover:text-foreground"
        >
          ✕
        </button>
      </div>
      {open && children}
    </div>
  );
}

function priceSummary({ priceMin, priceMax, noPrice }: PartsQuery, noPriceLabel: string) {
  if (noPrice) return noPriceLabel;
  if (priceMin !== null && priceMax !== null) return `${priceMin}–${priceMax} €`;
  if (priceMin !== null) return `≥ ${priceMin} €`;
  if (priceMax !== null) return `≤ ${priceMax} €`;
  return undefined;
}

type FiltersProps = { query: PartsQuery; brands: string[]; modelLabel: string | null; carLabel: string | null };

export function PartsFilters({ query, brands, modelLabel, carLabel }: FiltersProps) {
  const i18n = useI18n();
  const { t } = i18n;
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<Filter | "menu" | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
    };
    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function go(href: string) {
    setOpen(null);
    startTransition(() => router.push(href));
  }

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
          <StatusPanel query={query} apply={apply} />
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
          <BrandPanel query={query} brands={brands} apply={apply} />
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
      <div className="md:relative">
        <button
          type="button"
          onClick={() => setOpen((current) => (current === "menu" ? null : "menu"))}
          aria-expanded={open === "menu"}
          className="px-2 py-1 text-sm text-accent-text hover:underline"
        >
          + {t("filters.add")}
        </button>
        {open === "menu" && <AddFilterMenu onChoose={setOpen} />}
      </div>
      {hasFilters(query) && (
        <button
          type="button"
          onClick={() => go(clearedFiltersHref(query))}
          className="ml-auto rounded-md border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          {t("filters.clearAll")}
        </button>
      )}
    </div>
  );
}

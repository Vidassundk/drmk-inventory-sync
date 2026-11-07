// The cars list's state lives in the URL, like the parts list. No database imports: client components use this.
import { PAGE_SIZES } from "./parts-query";

export type CarsQuery = {
  q: string;
  page: number;
  pageSize: number;
  brand: string | null;
  model: number | null;
  /** Lithuanian values as stored, like "Dyzelinas"; the page shows them translated. Empty means all. */
  fuels: string[];
  gearboxes: string[];
};

const DEFAULTS: CarsQuery = {
  q: "",
  page: 1,
  pageSize: PAGE_SIZES[0],
  brand: null,
  model: null,
  fuels: [],
  gearboxes: [],
};

type RawParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const listParam = (value: string | string[] | undefined) =>
  (first(value)?.split(",") ?? []).map((item) => item.trim().slice(0, 40)).filter(Boolean);

export function parseCarsQuery(params: RawParams): CarsQuery {
  const page = Number(first(params.page));
  const pageSize = Number(first(params.pageSize));
  const model = Number(first(params.model));
  return {
    q: first(params.q)?.trim().slice(0, 100) ?? DEFAULTS.q,
    page: Number.isInteger(page) && page > 0 ? page : DEFAULTS.page,
    pageSize: PAGE_SIZES.find((size) => size === pageSize) ?? DEFAULTS.pageSize,
    brand: first(params.brand)?.trim().slice(0, 60) || DEFAULTS.brand,
    model: Number.isInteger(model) && model > 0 ? model : DEFAULTS.model,
    fuels: listParam(params.fuel),
    gearboxes: listParam(params.gearbox),
  };
}

export function carsHref(query: CarsQuery, changes: Partial<CarsQuery> = {}) {
  const next = { ...query, ...changes };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.page !== DEFAULTS.page) params.set("page", String(next.page));
  if (next.pageSize !== DEFAULTS.pageSize) params.set("pageSize", String(next.pageSize));
  if (next.brand) params.set("brand", next.brand);
  if (next.model) params.set("model", String(next.model));
  if (next.fuels.length > 0) params.set("fuel", next.fuels.join(","));
  if (next.gearboxes.length > 0) params.set("gearbox", next.gearboxes.join(","));
  const search = params.toString();
  return search ? `/cars?${search}` : "/cars";
}

export const hasCarFilters = ({ brand, model, fuels, gearboxes }: CarsQuery) =>
  brand !== null || model !== null || fuels.length > 0 || gearboxes.length > 0;

/** Clears every filter but keeps the search. */
export const clearedCarFiltersHref = (query: CarsQuery) =>
  carsHref({ ...DEFAULTS, q: query.q, pageSize: query.pageSize });

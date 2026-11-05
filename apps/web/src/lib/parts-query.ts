// The list's state lives in the URL, so links, refresh and the back button all work.
// No database imports here: client components use this file too.

export const PART_TABS = {
  stock: "Sandėlyje",
  reserved: "Rezervuota",
  sold: "Parduota",
  noPrice: "Be kainos",
  all: "Visi",
} as const;

export const PAGE_SIZES = [30, 50, 100] as const;

export type PartTab = keyof typeof PART_TABS;
export type PartsQuery = { tab: PartTab; q: string; page: number; pageSize: number };

const DEFAULTS: PartsQuery = { tab: "stock", q: "", page: 1, pageSize: PAGE_SIZES[0] };

type RawParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** Turns URL params into a valid query. Bad values fall back to defaults instead of erroring. */
export function parsePartsQuery(params: RawParams): PartsQuery {
  const tab = first(params.tab);
  const page = Number(first(params.page));
  const pageSize = Number(first(params.pageSize));
  return {
    tab: tab && tab in PART_TABS ? (tab as PartTab) : DEFAULTS.tab,
    q: first(params.q)?.trim().slice(0, 100) ?? DEFAULTS.q,
    page: Number.isInteger(page) && page > 0 ? page : DEFAULTS.page,
    pageSize: PAGE_SIZES.find((size) => size === pageSize) ?? DEFAULTS.pageSize,
  };
}

/** Builds a list URL, leaving out anything at its default to keep URLs short. */
export function partsHref(query: PartsQuery, changes: Partial<PartsQuery> = {}) {
  const next = { ...query, ...changes };
  const params = new URLSearchParams();
  if (next.tab !== DEFAULTS.tab) params.set("tab", next.tab);
  if (next.q) params.set("q", next.q);
  if (next.page !== DEFAULTS.page) params.set("page", String(next.page));
  if (next.pageSize !== DEFAULTS.pageSize) params.set("pageSize", String(next.pageSize));
  const search = params.toString();
  return search ? `/parts?${search}` : "/parts";
}

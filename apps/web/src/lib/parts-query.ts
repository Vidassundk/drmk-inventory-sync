// The list's state lives in the URL, so links, refresh and the back button all work.
// No database imports here: client components use this file too.

export const PAGE_SIZES = [30, 50, 100] as const;

export const PART_STATUSES = [
  "in_stock",
  "reserved",
  "sold",
  "returned",
  "written_off",
  "stock_audit",
  "template",
] as const;
export type PartStatus = (typeof PART_STATUSES)[number];

/** Parts you can still sell. An empty list of statuses means every status. */
const DEFAULT_STATUSES: PartStatus[] = ["in_stock", "reserved"];

export type PartsQuery = {
  q: string;
  page: number;
  pageSize: number;
  statuses: PartStatus[];
  priceMin: number | null;
  priceMax: number | null;
  noPrice: boolean;
  brand: string | null;
  /** Set together to list the parts of one kind for one car model, which is what "Sandėlyje" counts. */
  category: number | null;
  model: number | null;
};

const DEFAULTS: PartsQuery = {
  q: "",
  page: 1,
  pageSize: PAGE_SIZES[0],
  statuses: DEFAULT_STATUSES,
  priceMin: null,
  priceMax: null,
  noPrice: false,
  brand: null,
  category: null,
  model: null,
};

/** Tabs are shortcuts that set filters, so a tab and a filter can never disagree. */
const TAB_FILTERS = {
  stock: { statuses: DEFAULT_STATUSES, noPrice: false },
  reserved: { statuses: ["reserved"], noPrice: false },
  sold: { statuses: ["sold"], noPrice: false },
  noPrice: { statuses: DEFAULT_STATUSES, noPrice: true },
  all: { statuses: [], noPrice: false },
} satisfies Record<string, Pick<PartsQuery, "statuses" | "noPrice">>;

export type PartTab = keyof typeof TAB_FILTERS;
export const PART_TABS = Object.keys(TAB_FILTERS) as PartTab[];

const sameStatuses = (a: PartStatus[], b: PartStatus[]) => a.join() === b.join();
const hasPriceRange = ({ priceMin, priceMax }: PartsQuery) => priceMin !== null || priceMax !== null;

/** The tab matching the filters, if any. Custom filters match none, like "Parduota" plus a price range. */
export function activeTab(query: PartsQuery) {
  if (hasPriceRange(query)) return undefined;
  return PART_TABS.find((tab) => {
    const filters = TAB_FILTERS[tab];
    return sameStatuses(filters.statuses, query.statuses) && filters.noPrice === query.noPrice;
  });
}

export const tabHref = (query: PartsQuery, tab: PartTab) =>
  partsHref(query, { ...TAB_FILTERS[tab], priceMin: null, priceMax: null, page: 1 });

export const hasFilters = (query: PartsQuery) =>
  !sameStatuses(query.statuses, DEFAULT_STATUSES) ||
  hasPriceRange(query) ||
  query.noPrice ||
  query.brand !== null ||
  query.category !== null ||
  query.model !== null;

/** Clears every filter but keeps the search. */
export const clearedFiltersHref = (query: PartsQuery) =>
  partsHref({ ...DEFAULTS, q: query.q, pageSize: query.pageSize });

type RawParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

function idParam(value: string | string[] | undefined) {
  const id = Number(first(value));
  return Number.isInteger(id) && id > 0 ? id : null;
}

function priceParam(value: string | string[] | undefined) {
  const text = first(value)?.replace(",", ".");
  const price = text ? Number(text) : NaN;
  return Number.isFinite(price) && price >= 0 ? price : null;
}

function statusParam(value: string | string[] | undefined) {
  const text = first(value);
  if (text === "all") return [];
  const wanted = text?.split(",") ?? [];
  const statuses = PART_STATUSES.filter((status) => wanted.includes(status));
  return statuses.length > 0 ? statuses : DEFAULT_STATUSES;
}

/** Turns URL params into a valid query. Bad values fall back to defaults instead of erroring. */
export function parsePartsQuery(params: RawParams): PartsQuery {
  const page = Number(first(params.page));
  const pageSize = Number(first(params.pageSize));
  const noPrice = first(params.noPrice) === "1";
  return {
    q: first(params.q)?.trim().slice(0, 100) ?? DEFAULTS.q,
    page: Number.isInteger(page) && page > 0 ? page : DEFAULTS.page,
    pageSize: PAGE_SIZES.find((size) => size === pageSize) ?? DEFAULTS.pageSize,
    statuses: statusParam(params.status),
    // "No price" and a price range contradict each other, so "no price" wins.
    priceMin: noPrice ? null : priceParam(params.priceMin),
    priceMax: noPrice ? null : priceParam(params.priceMax),
    noPrice,
    brand: first(params.brand)?.trim().slice(0, 60) || DEFAULTS.brand,
    category: idParam(params.category),
    model: idParam(params.model),
  };
}

/** Builds a list URL, leaving out anything at its default to keep URLs short. */
/** The list of parts counted by "Sandėlyje" for one category and car model. */
export const similarPartsHref = (category: number, model: number) => partsHref(DEFAULTS, { category, model });

export function partsHref(query: PartsQuery, changes: Partial<PartsQuery> = {}) {
  const next = { ...query, ...changes };
  const params = new URLSearchParams();
  if (!sameStatuses(next.statuses, DEFAULTS.statuses)) params.set("status", next.statuses.join(",") || "all");
  if (next.priceMin !== null) params.set("priceMin", String(next.priceMin));
  if (next.priceMax !== null) params.set("priceMax", String(next.priceMax));
  if (next.noPrice) params.set("noPrice", "1");
  if (next.brand) params.set("brand", next.brand);
  if (next.q) params.set("q", next.q);
  if (next.page !== DEFAULTS.page) params.set("page", String(next.page));
  if (next.pageSize !== DEFAULTS.pageSize) params.set("pageSize", String(next.pageSize));
  if (next.category) params.set("category", String(next.category));
  if (next.model) params.set("model", String(next.model));
  const search = params.toString();
  return search ? `/parts?${search}` : "/parts";
}

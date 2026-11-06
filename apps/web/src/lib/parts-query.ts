// The list's state lives in the URL, so links, refresh and the back button all work.
// No database imports here: client components use this file too.

export const PART_TABS = ["stock", "reserved", "sold", "noPrice", "all"] as const;

export const PAGE_SIZES = [30, 50, 100] as const;

export type PartTab = (typeof PART_TABS)[number];
export type PartsQuery = {
  tab: PartTab;
  q: string;
  page: number;
  pageSize: number;
  /** Set together to list the parts of one kind for one car model, which is what "Sandėlyje" counts. */
  category: number | null;
  model: number | null;
};

const DEFAULTS: PartsQuery = { tab: "stock", q: "", page: 1, pageSize: PAGE_SIZES[0], category: null, model: null };

type RawParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

function idParam(value: string | string[] | undefined) {
  const id = Number(first(value));
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Turns URL params into a valid query. Bad values fall back to defaults instead of erroring. */
export function parsePartsQuery(params: RawParams): PartsQuery {
  const tab = first(params.tab);
  const page = Number(first(params.page));
  const pageSize = Number(first(params.pageSize));
  return {
    tab: PART_TABS.find((known) => known === tab) ?? DEFAULTS.tab,
    q: first(params.q)?.trim().slice(0, 100) ?? DEFAULTS.q,
    page: Number.isInteger(page) && page > 0 ? page : DEFAULTS.page,
    pageSize: PAGE_SIZES.find((size) => size === pageSize) ?? DEFAULTS.pageSize,
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
  if (next.tab !== DEFAULTS.tab) params.set("tab", next.tab);
  if (next.q) params.set("q", next.q);
  if (next.page !== DEFAULTS.page) params.set("page", String(next.page));
  if (next.pageSize !== DEFAULTS.pageSize) params.set("pageSize", String(next.pageSize));
  if (next.category) params.set("category", String(next.category));
  if (next.model) params.set("model", String(next.model));
  const search = params.toString();
  return search ? `/parts?${search}` : "/parts";
}

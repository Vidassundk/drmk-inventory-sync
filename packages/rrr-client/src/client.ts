import type {
  GetCarsResult,
  GetPartsParams,
  GetPartsResult,
  RrrCar,
  RrrCarBrand,
  RrrCarModel,
  RrrCredentials,
  RrrLookup,
  RrrPagination,
  RrrPart,
} from "./types.ts";

export class RrrApiError extends Error {
  readonly httpStatus: number;
  readonly statusCode: string | undefined;

  constructor(message: string, httpStatus: number, statusCode?: string) {
    super(message);
    this.name = "RrrApiError";
    this.httpStatus = httpStatus;
    this.statusCode = statusCode;
  }
}

export type RrrClientOptions = RrrCredentials & {
  baseUrl?: string;
  fetch?: typeof fetch;
};

export class RrrClient {
  private readonly baseUrl: string;
  private readonly credentials: RrrCredentials;
  private readonly fetchImpl: typeof fetch;

  constructor({ baseUrl = "https://api.rrr.lt/", fetch: fetchImpl = fetch, ...credentials }: RrrClientOptions) {
    this.baseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
    this.credentials = credentials;
    this.fetchImpl = fetchImpl;
  }

  /** POST /v2/get/parts — one page of the account's parts (products). */
  async getParts(params: GetPartsParams = {}): Promise<GetPartsResult> {
    const query = new URLSearchParams();
    if (params.page) query.set("page", String(params.page));
    if (params.limit) query.set("limit", String(params.limit));
    if (params.dateFrom) query.set("date_from", params.dateFrom);
    if (params.dateTo) query.set("date_to", params.dateTo);
    if (params.search) query.set("search", params.search);
    if (params.externalIds?.length) query.set("external_ids", params.externalIds.join(","));
    for (const [field, dir] of Object.entries(params.sort ?? {})) query.set(`sort[${field}]`, dir);

    const body = await this.post("v2/get/parts", query);
    return {
      parts: (body.data as RrrPart[] | undefined) ?? [],
      pagination: readPagination(body.pagination),
    };
  }

  /** Walks every page of /v2/get/parts, by id ascending unless `sort` says otherwise. */
  async *iterateParts(params: Omit<GetPartsParams, "page"> = {}): AsyncGenerator<RrrPart> {
    const limit = params.limit ?? 100;
    const sort = params.sort ?? { id: "asc" };
    for (let page = 1; ; page++) {
      const { parts, pagination } = await this.getParts({ ...params, sort, page, limit });
      yield* parts;
      if (parts.length === 0 || page * limit >= pagination.total_count) return;
    }
  }

  /**
   * Parts with updated_at >= `since`, newest first. Paging newest-first means a
   * part updated mid-walk moves to page 1 and pushes others down, which can
   * repeat a part but never skip one, so callers should upsert idempotently.
   * `since` uses the API's own "YYYY-MM-DD HH:mm:ss" format and timezone.
   */
  async *iteratePartsUpdatedSince(since: string, params: Pick<GetPartsParams, "limit"> = {}): AsyncGenerator<RrrPart> {
    for await (const part of this.iterateParts({ ...params, sort: { updated_at: "desc" } })) {
      if (part.updated_at < since) return;
      yield part;
    }
  }

  /** POST /v2/get/cars — one page of the account's donor cars, newest first unless told otherwise. */
  async getCars({
    page = 1,
    limit = 100,
    sort = "desc",
  }: { page?: number; limit?: number; sort?: "asc" | "desc" } = {}) {
    const query = new URLSearchParams({ page: String(page), limit: String(limit), "sort[id]": sort });
    const body = await this.post("v2/get/cars", query);
    return {
      cars: (body.data as RrrCar[] | undefined) ?? [],
      pagination: readPagination(body.pagination),
    } satisfies GetCarsResult;
  }

  /** Walks every page of /v2/get/cars. */
  async *iterateCars(): AsyncGenerator<RrrCar> {
    for (let page = 1; ; page++) {
      const { cars, pagination } = await this.getCars({ page });
      yield* cars;
      if (cars.length === 0 || page * pagination.limit >= pagination.total_count) return;
    }
  }

  async getCarBrands() {
    return readList<RrrCarBrand>(await this.post("get/car_brands", new URLSearchParams()));
  }

  async getCarModels(brandId: string) {
    try {
      return readList<RrrCarModel>(await this.post(`get/car_models/${brandId}`, new URLSearchParams()));
    } catch (err) {
      // RRR answers a brand with no models with an error, not an empty list.
      if (err instanceof RrrApiError && err.message.includes("No car models found")) return [];
      throw err;
    }
  }

  /** A code table as code -> Lithuanian name. */
  async getLookup(name: RrrLookup) {
    const body = await this.post(`get/${name}`, new URLSearchParams());
    const list = (body.list ?? {}) as Record<string, { lt?: string; en?: string }>;
    return Object.fromEntries(Object.entries(list).map(([code, names]) => [code, names.lt ?? names.en ?? ""]));
  }

  private async post(path: string, query: URLSearchParams): Promise<Record<string, unknown>> {
    const url = new URL(path, this.baseUrl);
    url.search = query.toString();

    const res = await this.fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        username: this.credentials.username,
        password: this.credentials.password,
        user_token: this.credentials.userToken,
      }),
    });

    const text = await res.text();
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(text);
    } catch {
      throw new RrrApiError(`Non-JSON response (HTTP ${res.status}): ${text.slice(0, 200)}`, res.status);
    }

    // RRR reports errors in status_code ("R200" = OK), sometimes with HTTP 200.
    const statusCode = typeof body.status_code === "string" ? body.status_code : undefined;
    if (!res.ok || (statusCode && statusCode !== "R200")) {
      throw new RrrApiError(`RRR ${path} failed: ${String(body.msg ?? res.statusText)}`, res.status, statusCode);
    }
    return body;
  }
}

// Catalog endpoints answer with `list` and the v2 ones with `data`; some are keyed objects rather than arrays.
function readList<T>(body: Record<string, unknown>): T[] {
  return Object.values((body.list ?? body.data ?? {}) as Record<string, T>);
}

// The spec nests pagination twice ({pagination: {pagination: {...}}}) while its
// example is flat, so accept either.
function readPagination(raw: unknown): RrrPagination {
  const outer = (raw ?? {}) as Record<string, unknown>;
  const p = (outer.pagination ?? outer) as Record<string, unknown>;
  return {
    page: Number(p.page ?? 1),
    total_count: Number(p.total_count ?? 0),
    limit: Number(p.limit ?? 0),
  };
}

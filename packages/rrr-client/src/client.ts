import type { GetPartsParams, GetPartsResult, RrrCredentials, RrrPagination, RrrPart } from "./types.ts";

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

    const body = await this.post("v2/get/parts", query);
    return {
      parts: (body.data as RrrPart[] | undefined) ?? [],
      pagination: readPagination(body.pagination),
    };
  }

  /** Walks every page of /v2/get/parts. */
  async *iterateParts(params: Omit<GetPartsParams, "page"> = {}): AsyncGenerator<RrrPart> {
    const limit = params.limit ?? 100;
    for (let page = 1; ; page++) {
      const { parts, pagination } = await this.getParts({ ...params, page, limit });
      yield* parts;
      if (parts.length === 0 || page * limit >= pagination.total_count) return;
    }
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

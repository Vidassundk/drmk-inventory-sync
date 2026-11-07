// Shapes from https://api.rrr.lt/openapi/swagger.yaml, corrected against live
// responses (the spec omits updated_at, currency fields, place, etc.). The API
// returns most numeric fields as strings, so they're typed as strings here.

export type RrrCredentials = {
  username: string;
  password: string;
  userToken: string;
};

/** From /get/part_status. */
export const PART_STATUS = {
  inStock: "0",
  reserved: "1",
  soldOut: "2",
  returned: "3",
  writtenOff: "4",
} as const;

export type RrrPartStatus = (typeof PART_STATUS)[keyof typeof PART_STATUS];

export type RrrPart = {
  id: string;
  id_bridge: string | number;
  car_id: string;
  category_id: string;
  name: string;
  manufacturer_code: string;
  visible_code: string;
  other_code: string;
  quality: string;
  notes: string;
  internal_notes: string;
  sticker_note: string | null;
  price: string;
  currency: string;
  original_price: string;
  original_currency: string;
  /** Listing date; can differ from create_date. */
  date: string;
  /** "YYYY-MM-DD HH:mm:ss", timezone unspecified (likely Europe/Vilnius). */
  create_date: string;
  /** Not in the spec. Bumped on edits, price changes and sales; use as the sync cursor. */
  updated_at: string;
  mechanic: string;
  status: RrrPartStatus;
  reserved_user: string;
  reserved_date: string | null;
  position: string | null;
  place: string | null;
  photo: string | null;
  part_photo_gallery: string[];
  external_id: string | null;
  shop_url: string | null;
  show_url: string | null;
  // Wheel/tire attributes, null for other parts.
  rims: string | null;
  tires: string | null;
  rims_fixing_points: string | null;
  rims_spacing: string | null;
  rims_quantity: string | null;
  rims_central_diameter: string | null;
  tires_width: string | null;
  tires_height: string | null;
  tires_quantity: string | null;
  [key: string]: unknown;
};

export type RrrPagination = {
  page: number;
  total_count: number;
  limit: number;
};

/** The API rejects other fields (including the spec's "date"). */
export type PartSortField = "id" | "create_date" | "updated_at";

export type GetPartsParams = {
  page?: number;
  /** 1..100 */
  limit?: number;
  /** Filters on date added, not updated. */
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  externalIds?: string[];
  sort?: Partial<Record<PartSortField, "asc" | "desc">>;
};

export type GetPartsResult = {
  parts: RrrPart[];
  pagination: RrrPagination;
};

/** One donor car. Most fields are codes for the lookup tables, and values are strings ("" when unset). */
export type RrrCar = {
  id: string;
  car_model: string;
  car_years: string;
  car_body_type: string;
  car_fuel: string;
  car_engine_power: string;
  car_engine_cubic_capacity: string;
  car_color: string;
  car_wheel_drive: string;
  [field: string]: unknown;
};

export type RrrCarBrand = { id: string; name: string };
export type RrrCarModel = { id: string; brand: string; name: string; year_start: string; year_end: string };

export type RrrNames = { lt?: string; en?: string; ru?: string };
export type RrrCategory = RrrNames & { id: string; parent_id: string; level: string };

/** Code tables that translate RRR's numeric codes into names. */
export type RrrLookup = "fuel" | "color" | "wheel_drive" | "car_body_type";

export type GetCarsResult = { cars: RrrCar[]; pagination: RrrPagination };

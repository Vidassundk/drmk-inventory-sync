// Shapes from https://api.rrr.lt/openapi/swagger.yaml. The API returns most
// numeric fields as strings, so they're typed as strings here and parsed later.

export type RrrCredentials = {
  username: string;
  password: string;
  userToken: string;
};

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
  price: string;
  date: string;
  status: string;
  photo: string | null;
  part_photo_gallery: string[];
  external_id: string | null;
  create_date: string;
  [key: string]: unknown;
};

export type RrrPagination = {
  page: number;
  total_count: number;
  limit: number;
};

export type GetPartsParams = {
  page?: number;
  /** 1..100 */
  limit?: number;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  externalIds?: string[];
};

export type GetPartsResult = {
  parts: RrrPart[];
  pagination: RrrPagination;
};

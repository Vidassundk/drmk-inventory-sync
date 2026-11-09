// Which columns the parts table shows, and in what order. No server imports: the settings panel uses this too.

export const PART_COLUMNS = [
  { key: "id", locked: true },
  { key: "photo", locked: true },
  { key: "part", locked: true },
  { key: "codes" },
  { key: "price" },
  { key: "stock" },
  { key: "car" },
  { key: "position" },
  { key: "quality" },
  { key: "adText" },
  { key: "status" },
  { key: "reservedBy" },
  { key: "reservedAt" },
  { key: "createdBy" },
  { key: "listedAt" },
] as const;

export type PartColumnKey = (typeof PART_COLUMNS)[number]["key"];
export type ColumnSettings = { order: PartColumnKey[]; hidden: PartColumnKey[] };

export const COLUMNS_COOKIE = "parts-columns";

const ALL_KEYS: PartColumnKey[] = PART_COLUMNS.map((column) => column.key);
const isKey = (key: unknown): key is PartColumnKey => ALL_KEYS.includes(key as PartColumnKey);

export const isLocked = (key: PartColumnKey) => "locked" in PART_COLUMNS.find((column) => column.key === key)!;

export const DEFAULT_COLUMN_SETTINGS: ColumnSettings = { order: ALL_KEYS, hidden: [] };

/** Reads the cookie. Unknown columns are dropped, and columns added since it was saved appear at the end. */
export function parseColumnSettings(cookie: string | undefined): ColumnSettings {
  try {
    const { order, hidden } = JSON.parse(decodeURIComponent(cookie ?? ""));
    const known = (order as unknown[]).filter(isKey);
    return {
      order: [...known, ...ALL_KEYS.filter((key) => !known.includes(key))],
      hidden: (hidden as unknown[]).filter(isKey).filter((key) => !isLocked(key)),
    };
  } catch {
    return DEFAULT_COLUMN_SETTINGS;
  }
}

export const visibleColumns = ({ order, hidden }: ColumnSettings) => order.filter((key) => !hidden.includes(key));

/** Reservation columns are for admins only. */
const ADMIN_COLUMNS: PartColumnKey[] = ["reservedBy", "reservedAt"];

export function columnSettingsFor({ order, hidden }: ColumnSettings, admin: boolean): ColumnSettings {
  if (admin) return { order, hidden };
  return { order: order.filter((key) => !ADMIN_COLUMNS.includes(key)), hidden };
}

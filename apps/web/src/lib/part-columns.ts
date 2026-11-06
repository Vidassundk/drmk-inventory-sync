// Which columns the parts table shows, and in what order. No server imports: the settings panel uses this too.

export const PART_COLUMNS = [
  { key: "id", label: "ID", locked: true },
  { key: "photo", label: "Foto", locked: true },
  { key: "part", label: "Dalis", locked: true },
  { key: "codes", label: "Dalies kodai" },
  { key: "price", label: "Kaina" },
  { key: "stock", label: "Sandėlyje" },
  { key: "car", label: "Automobilio informacija" },
  { key: "otherInfo", label: "Kita informacija" },
  { key: "quality", label: "Kokybė" },
  { key: "place", label: "Vieta (kodas)" },
  { key: "internalNotes", label: "Vidinė pastaba" },
  { key: "adText", label: "Skelbimo tekstas" },
  { key: "status", label: "Statusas" },
  { key: "reservedBy", label: "Rezervavo" },
  { key: "reservedAt", label: "Rezervacijos data" },
  { key: "createdBy", label: "Sukūrė" },
  { key: "listedAt", label: "Pridėta" },
] as const;

export type PartColumnKey = (typeof PART_COLUMNS)[number]["key"];
export type ColumnSettings = { order: PartColumnKey[]; hidden: PartColumnKey[] };

export const COLUMNS_COOKIE = "parts-columns";

const ALL_KEYS: PartColumnKey[] = PART_COLUMNS.map((column) => column.key);
const isKey = (key: unknown): key is PartColumnKey => ALL_KEYS.includes(key as PartColumnKey);

export const columnOf = (key: PartColumnKey) => PART_COLUMNS.find((column) => column.key === key)!;
export const isLocked = (key: PartColumnKey) => "locked" in columnOf(key);

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

type Status = "in_stock" | "reserved" | "sold" | "returned" | "written_off" | "stock_audit" | "template" | "unknown";

export const STATUS_LABELS: Record<Status, string> = {
  in_stock: "Yra sandėlyje",
  reserved: "Rezervuota",
  sold: "Parduota",
  returned: "Grąžinta",
  written_off: "Nurašyta",
  stock_audit: "Atsargų auditas",
  template: "Šablonas",
  unknown: "Nežinoma",
};

// From RRR's /get/part_quality. There are only four, so they live here instead of in a table.
const QUALITY_LABELS: Record<number, string> = { 0: "Naudota", 1: "Nauja", 3: "Su defektais", 4: "Restauruota" };

// From RRR's /get/part_position.
const POSITION_LABELS: Record<string, string> = {
  "10": "Visos",
  "20": "Kairėje",
  "30": "Centras",
  "40": "Dešinė",
  "50": "Komplektas",
  "60": "Gale kairėje",
  "70": "Gale dešinėje",
  "80": "Priekyje kairėje",
  "90": "Priekyje dešinėje",
  "100": "Priekyje",
  "110": "Gale",
};

// RRR's API has no user list and only gives ids, so names are added here as we learn them.
const USER_NAMES: Record<string, string> = { "8": "Gvidas Gečas" };

const ITEM_WORDS: Partial<Record<Intl.LDMLPluralRule, string>> = { one: "prekė", few: "prekės" };
const lithuanianPlural = new Intl.PluralRules("lt-LT");

/** "1 prekė", "3 prekės", "12 prekių". */
export const itemCount = (count: number) => `${count} ${ITEM_WORDS[lithuanianPlural.select(count)] ?? "prekių"}`;

export const positionLabel = (code: string | null) => (code ? (POSITION_LABELS[code] ?? code) : null);

export const userName = (id: string | null) => (id && id !== "0" ? (USER_NAMES[id] ?? `#${id}`) : null);

export const qualityLabel = (quality: number | null) => (quality === null ? "–" : (QUALITY_LABELS[quality] ?? "–"));

export function formatPrice({ price, currency }: { price: string | null; currency: string | null }) {
  if (!price || Number(price) === 0) return "–";
  return new Intl.NumberFormat("lt-LT", { style: "currency", currency: currency ?? "EUR" }).format(Number(price));
}

type CarTitle = {
  carBrand: string | null;
  carModel: string | null;
  carYearStart: number | null;
  carYearEnd: number | null;
};

export function carTitle({ carBrand, carModel, carYearStart, carYearEnd }: CarTitle) {
  if (!carBrand) return null;
  const years = carYearStart ? ` (${carYearStart} - ${carYearEnd ?? ""})` : "";
  return `${carBrand} ${carModel}${years}`;
}

type CarDetails = {
  carYear: number | null;
  carBodyType: string | null;
  carFuel: string | null;
  carPowerKw: number | null;
  carEngineCc: number | null;
  carColor: string | null;
  carWheelDrive: string | null;
};

export function carDetails(car: CarDetails) {
  const engine = [car.carPowerKw && `${car.carPowerKw}kW`, car.carEngineCc && `${car.carEngineCc}cm³`]
    .filter(Boolean)
    .join(", ");
  return [car.carYear, car.carBodyType, car.carFuel, engine, car.carColor, car.carWheelDrive]
    .filter(Boolean)
    .join(" | ");
}

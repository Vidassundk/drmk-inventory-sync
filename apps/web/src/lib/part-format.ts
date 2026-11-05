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

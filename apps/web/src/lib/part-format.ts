import type { I18n, MessageKey } from "@/lib/i18n";

// RRR's API has no user list and only gives ids, so names are added here as we learn them.
const USER_NAMES: Record<string, string> = { "8": "Gvidas Gečas" };

export const userName = (id: string | null) => (id && id !== "0" ? (USER_NAMES[id] ?? `#${id}`) : null);

export const statusLabel = ({ t }: I18n, status: string) => t(`status.${status}` as MessageKey);

/** RRR's codes for quality and position, which may gain values we don't have a name for yet. */
export const qualityLabel = ({ has, t }: I18n, quality: number | null) => {
  const key = `quality.${quality}`;
  return has(key) ? t(key) : "–";
};

export const positionLabel = ({ has, t }: I18n, code: string | null) => {
  const key = `position.${code}`;
  return !code ? null : has(key) ? t(key) : code;
};

export function formatPrice(
  { intlLocale }: I18n,
  { price, currency }: { price: string | null; currency: string | null },
) {
  if (!price || Number(price) === 0) return "–";
  return new Intl.NumberFormat(intlLocale, { style: "currency", currency: currency ?? "EUR" }).format(Number(price));
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

type CarOption = CarTitle &
  CarDetails & {
    id: number;
    carSteering: string | null;
    carGearbox: string | null;
  };

/** RRR's label for one donor car: "#826: BMW 3 E46 (2002, Kupė (Coupe), Dyzelinas, 85kW, 1995cm³, ...)". */
export function carOption(car: CarOption) {
  const details = [
    car.carYear,
    car.carBodyType,
    car.carFuel,
    car.carPowerKw && `${car.carPowerKw}kW`,
    car.carEngineCc && `${car.carEngineCc}cm³`,
    car.carColor,
    car.carWheelDrive,
    car.carSteering,
    car.carGearbox,
  ].filter(Boolean);
  return `#${car.id}: ${car.carBrand ?? ""} ${car.carModel ?? ""} (${details.join(", ")})`;
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

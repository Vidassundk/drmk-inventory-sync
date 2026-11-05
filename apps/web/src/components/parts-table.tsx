import { PartCover } from "@/components/part-cover";
import type { PartRow } from "@/lib/parts";

const STATUS_LABELS: Record<PartRow["status"], string> = {
  in_stock: "Yra sandėlyje",
  reserved: "Rezervuota",
  sold: "Parduota",
  returned: "Grąžinta",
  written_off: "Nurašyta",
  stock_audit: "Atsargų auditas",
  template: "Šablonas",
  unknown: "Nežinoma",
};

function formatPrice({ price, currency }: PartRow) {
  if (!price || Number(price) === 0) return "–";
  return new Intl.NumberFormat("lt-LT", { style: "currency", currency: currency ?? "EUR" }).format(Number(price));
}

function carTitle({ carBrand, carModel, carYearStart, carYearEnd }: PartRow) {
  if (!carBrand) return null;
  const years = carYearStart ? ` (${carYearStart} - ${carYearEnd ?? ""})` : "";
  return `${carBrand} ${carModel}${years}`;
}

function carDetails(part: PartRow) {
  const engine = [part.carPowerKw && `${part.carPowerKw}kW`, part.carEngineCc && `${part.carEngineCc}cm³`]
    .filter(Boolean)
    .join(", ");
  return [part.carYear, part.carBodyType, part.carFuel, engine, part.carColor, part.carWheelDrive]
    .filter(Boolean)
    .join(" | ");
}

const HEADERS = ["ID", "Foto", "Dalis", "Dalies kodai", "Kaina", "Automobilis", "Statusas", "Pridėta"];

export function PartsTable({ rows }: { rows: PartRow[] }) {
  if (rows.length === 0) {
    return <p className="py-16 text-center text-sm text-zinc-500">Dalių nerasta.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-full min-w-[64rem] text-left text-sm">
        <thead className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800">
          <tr>
            {HEADERS.map((header) => (
              <th key={header} scope="col" className="px-3 py-2 font-medium whitespace-nowrap">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
          {rows.map((part) => (
            <tr key={part.id} className="align-top">
              <td className="px-3 py-2 font-medium tabular-nums">{part.rrrId}</td>
              <td className="px-3 py-2">
                <PartCover src={part.coverUrl} alt={part.name} photoCount={part.photoCount} />
              </td>
              <td className="max-w-64 px-3 py-2">{part.name}</td>
              <td className="px-3 py-2 font-mono text-xs">
                {[part.manufacturerCode, part.visibleCode, part.otherCode].filter(Boolean).map((code) => (
                  <div key={code}>{code}</div>
                ))}
              </td>
              <td className="px-3 py-2 whitespace-nowrap tabular-nums">{formatPrice(part)}</td>
              <td className="max-w-72 px-3 py-2">
                {part.rrrCarId ? (
                  <>
                    <div className="font-medium">
                      <span className="mr-1.5 rounded bg-zinc-100 px-1 text-xs font-normal text-zinc-500 tabular-nums dark:bg-zinc-900">
                        {part.rrrCarId}
                      </span>
                      {carTitle(part)}
                    </div>
                    <div className="text-xs text-zinc-500">{carDetails(part)}</div>
                  </>
                ) : (
                  "–"
                )}
              </td>
              <td className="px-3 py-2 whitespace-nowrap">{STATUS_LABELS[part.status]}</td>
              <td className="px-3 py-2 whitespace-nowrap text-zinc-500 tabular-nums">{part.listedAt?.slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

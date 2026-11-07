import type { ReactNode } from "react";
import { AppLink } from "@/components/app-link";
import { PartCover } from "@/components/part-cover";
import type { CarRow } from "@/lib/cars";
import { getI18n } from "@/lib/i18n-server";
import type { MessageKey } from "@/lib/i18n";

const NOWRAP = "whitespace-nowrap";
const PILL = "inline-block rounded bg-zinc-100 px-1.5 py-0.5 text-xs tabular-nums whitespace-nowrap dark:bg-zinc-900";

const text = (value: string | number | null) => (value === null || value === "" ? "–" : value);

const COLUMNS: {
  label: MessageKey;
  cell?: string;
  render: (car: CarRow, t: (key: MessageKey, values?: Record<string, number>) => string) => ReactNode;
}[] = [
  { label: "columns.id", cell: "font-medium tabular-nums", render: (car) => car.id },
  {
    label: "columns.photo",
    render: (car) => (
      <PartCover src={car.photoUrl} alt={`${car.brand ?? ""} ${car.model ?? ""}`} photoCount={car.photoCount} />
    ),
  },
  {
    label: "cars.car",
    cell: "min-w-40 max-w-56",
    render: (car) => (
      <AppLink href={`/cars/${car.id}`} className="font-medium hover:underline">
        {car.brand} {car.model} {car.year && `(${car.year})`}
      </AppLink>
    ),
  },
  {
    label: "cars.parts",
    render: (car, t) => (
      <div className="flex flex-col items-start gap-1">
        <AppLink href={`/parts?car=${car.id}&status=in_stock`} className={`${PILL} hover:text-accent-text`}>
          {t("cars.inStock", { count: car.inStock })}
        </AppLink>
        <AppLink href={`/parts?car=${car.id}&status=sold`} className={`${PILL} hover:text-accent-text`}>
          {t("cars.sold", { count: car.sold })}
        </AppLink>
      </div>
    ),
  },
  { label: "filters.fuel", cell: NOWRAP, render: (car) => text(car.fuel) },
  { label: "filters.gearbox", cell: NOWRAP, render: (car) => text(car.gearbox) },
  { label: "cars.wheelDrive", cell: NOWRAP, render: (car) => text(car.wheelDrive) },
  { label: "cars.steering", cell: NOWRAP, render: (car) => text(car.steering) },
  {
    label: "cars.engineCc",
    cell: "whitespace-nowrap tabular-nums",
    render: (car) => (car.engineCc ? `${car.engineCc} cm³` : "–"),
  },
  {
    label: "cars.power",
    cell: "whitespace-nowrap tabular-nums",
    render: (car) => (car.powerKw ? `${car.powerKw} kW` : "–"),
  },
  { label: "cars.color", cell: NOWRAP, render: (car) => text(car.color) },
  { label: "cars.bodyType", cell: NOWRAP, render: (car) => text(car.bodyType) },
];

export async function CarsTable({ rows }: { rows: CarRow[] }) {
  const { t } = await getI18n();

  if (rows.length === 0) {
    return <p className="py-16 text-center text-sm text-muted">{t("cars.empty")}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-max min-w-full text-left text-sm">
        <thead className="border-b border-zinc-200 text-xs text-muted dark:border-zinc-800">
          <tr>
            {COLUMNS.map((column) => (
              <th key={column.label} scope="col" className="px-3 py-2 font-medium whitespace-nowrap">
                {t(column.label)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
          {rows.map((car) => (
            <tr key={car.id} className="align-top">
              {COLUMNS.map((column) => (
                <td key={column.label} className={`px-3 py-2 ${column.cell ?? ""}`}>
                  {column.render(car, t)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

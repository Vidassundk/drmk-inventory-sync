import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AppLink } from "@/components/app-link";
import { BackToList } from "@/components/back-to-list";
import { PartGallery } from "@/components/part-gallery";
import { getCar, type CarDetail } from "@/lib/cars";
import type { I18n } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n-server";
import { carPartsHref, type PartsQuery } from "@/lib/parts-query";

const carName = (car: CarDetail) => [car.brand, car.model].filter(Boolean).join(" ") || `#${car.id}`;

export async function generateMetadata({ params }: PageProps<"/cars/[id]">): Promise<Metadata> {
  const { t } = await getI18n();
  const car = await getCar(Number((await params).id));
  return { title: car ? carName(car) : t("car.notFound") };
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  if (children === null || children === undefined || children === "") return null;
  return (
    <div className="grid grid-cols-[10rem_1fr] gap-3 py-2 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 wrap-break-word whitespace-pre-line">{children}</dd>
    </div>
  );
}

/** One line of the statistics card: the parts' value and how many, linking to them in the parts list. */
function StatRow({
  i18n,
  label,
  value,
  count,
  href,
}: {
  i18n: I18n;
  label: string;
  value?: number;
  count: number;
  href: string;
}) {
  const money = new Intl.NumberFormat(i18n.intlLocale, { style: "currency", currency: "EUR" });
  return (
    <AppLink
      href={href}
      className="-mx-2 grid grid-cols-[1fr_auto_3rem] items-center gap-3 rounded px-2 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900"
    >
      <span className="text-muted">{label}</span>
      <span className="tabular-nums">{value === undefined ? "" : money.format(value)}</span>
      <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-right text-xs tabular-nums dark:bg-zinc-900">
        {count}
      </span>
    </AppLink>
  );
}

export default async function CarPage({ params }: PageProps<"/cars/[id]">) {
  const i18n = await getI18n();
  const { t, intlLocale } = i18n;
  const car = await getCar(Number((await params).id));
  if (!car) notFound();

  const { stats } = car;
  const number = new Intl.NumberFormat(intlLocale);
  const years = car.yearStart ? `${car.yearStart} – ${car.yearEnd ?? ""}` : null;
  const facts = [
    car.year,
    car.bodyType,
    car.fuel,
    car.powerKw && `${car.powerKw} kW`,
    car.engineCc && `${car.engineCc} cm³`,
  ].filter(Boolean);
  const partsHref = (changes: Partial<PartsQuery>) => carPartsHref(car.id, changes);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-4 md:p-6">
      <BackToList href="/cars" label="cars.title" />
      <div>
        <h1 className="text-xl font-semibold">
          <span className="text-muted tabular-nums">#{car.id}</span> {carName(car)}
          {years && <span className="font-normal"> ({years})</span>}
        </h1>
        {facts.length > 0 && <p className="text-sm text-muted">{facts.join(" · ")}</p>}
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-6">
          <PartGallery
            urls={car.photos.map((photo) => photo.url)}
            thumbs={car.photos.map((photo) => photo.thumb)}
            alt={carName(car)}
          />
          <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <h2 className="mb-2 flex items-baseline justify-between gap-3 font-semibold">
              {t("car.stats")}
              <span className="text-xs font-normal text-muted">{t("car.withVat")}</span>
            </h2>
            <StatRow
              i18n={i18n}
              label={t("car.partsTotal")}
              value={stats.allValue}
              count={stats.all}
              href={partsHref({ statuses: ["in_stock", "reserved", "sold"] })}
            />
            <StatRow
              i18n={i18n}
              label={t("car.partsInStock")}
              value={stats.inStockValue}
              count={stats.inStock}
              href={partsHref({ statuses: ["in_stock"] })}
            />
            <StatRow
              i18n={i18n}
              label={t("car.partsReserved")}
              value={stats.reservedValue}
              count={stats.reserved}
              href={partsHref({ statuses: ["reserved"] })}
            />
            <StatRow
              i18n={i18n}
              label={t("car.partsSold")}
              value={stats.soldValue}
              count={stats.sold}
              href={partsHref({ statuses: ["sold"] })}
            />
            <StatRow
              i18n={i18n}
              label={t("car.partsUnpriced")}
              count={stats.unpriced}
              href={partsHref({ statuses: ["in_stock"], noPrice: true })}
            />
          </section>
        </div>
        <section>
          <h2 className="mb-1 font-semibold">{t("car.info")}</h2>
          <dl className="divide-y divide-zinc-100 dark:divide-zinc-900">
            <Field label={t("car.brand")}>{car.brand}</Field>
            <Field label={t("car.model")}>{car.model}</Field>
            <Field label={t("car.modelYears")}>{years}</Field>
            <Field label={t("car.year")}>{car.year}</Field>
            <Field label={t("filters.fuel")}>{car.fuel}</Field>
            <Field label={t("car.mileage")}>{car.mileageKm ? `${number.format(car.mileageKm)} km` : null}</Field>
            <Field label={t("cars.engineCc")}>{car.engineCc ? `${car.engineCc} cm³` : null}</Field>
            <Field label={t("cars.power")}>{car.powerKw ? `${car.powerKw} kW` : null}</Field>
            <Field label={t("car.engineCode")}>{car.engineCode}</Field>
            <Field label={t("filters.gearbox")}>{car.gearbox}</Field>
            <Field label={t("car.gearboxCode")}>{car.gearboxCode}</Field>
            <Field label={t("cars.bodyType")}>{car.bodyType}</Field>
            <Field label={t("cars.wheelDrive")}>{car.wheelDrive}</Field>
            <Field label={t("cars.steering")}>{car.steering}</Field>
            <Field label={t("cars.color")}>{car.color}</Field>
            <Field label={t("car.colorCode")}>{car.colorCode}</Field>
            <Field label={t("car.interior")}>{car.interior}</Field>
            <Field label={t("car.defects")}>{car.defects}</Field>
            <Field label={t("car.vin")}>{car.vin && <span className="font-mono">{car.vin}</span>}</Field>
          </dl>
        </section>
      </div>
    </main>
  );
}

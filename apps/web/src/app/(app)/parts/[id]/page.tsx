import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { AppLink } from "@/components/app-link";
import { BackToList } from "@/components/back-to-list";
import { PartGallery } from "@/components/part-gallery";
import { ReservationControl } from "@/components/reservation-control";
import { SimilarParts } from "@/components/similar-parts";
import { getI18n } from "@/lib/i18n-server";
import {
  carDetails,
  carTitle,
  formatPrice,
  positionLabel,
  qualityLabel,
  statusLabel,
  userName,
} from "@/lib/part-format";
import { getPart } from "@/lib/parts";
import { listClients, reservationFor } from "@/lib/reservations";

export async function generateMetadata({ params }: PageProps<"/parts/[id]">): Promise<Metadata> {
  const { t } = await getI18n();
  const part = await getPart((await params).id);
  return { title: part?.name ?? t("part.notFound") };
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  if (!children) return null;
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-3 py-2 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 wrap-break-word whitespace-pre-line">{children}</dd>
    </div>
  );
}

export default async function PartPage({ params }: PageProps<"/parts/[id]">) {
  const i18n = await getI18n();
  const { t } = i18n;
  const part = await getPart((await params).id);
  if (!part) notFound();
  // Admins can reserve a part in stock, or reassign or release a reserved one.
  const reservable = part.admin && !part.deletedAt && (part.status === "in_stock" || part.status === "reserved");
  const [clients, clientId] = reservable ? await Promise.all([listClients(), reservationFor(part.id)]) : [[], null];

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-4 md:p-6">
      <BackToList />
      <div>
        <h1 className="text-xl font-semibold">{part.name}</h1>
        {part.categoryPath && <p className="text-sm text-muted">{part.categoryPath}</p>}
      </div>
      {part.deletedAt && (
        <p className="rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {t("part.removed")}
        </p>
      )}
      <div className="grid gap-6 md:grid-cols-2">
        <PartGallery urls={part.photoUrls} alt={part.name} />
        <div className="flex flex-col gap-4">
          {reservable && (
            <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <h2 className="mb-1 font-semibold">{t("reservations.title")}</h2>
              <p className="mb-3 text-sm text-muted">
                {part.status === "reserved"
                  ? clientId
                    ? t("reservations.reservedFor", {
                        name: clients.find((client) => client.id === clientId)?.name ?? "",
                      })
                    : t("reservations.noClientYet")
                  : t("reservations.inStockHint")}
              </p>
              <ReservationControl
                partId={part.id}
                reserved={part.status === "reserved"}
                clientId={clientId}
                clients={clients}
              />
            </section>
          )}
          <dl className="divide-y divide-zinc-100 dark:divide-zinc-900">
            <Field label={t("columns.id")}>{part.rrrId}</Field>
            {part.admin && <Field label={t("columns.status")}>{statusLabel(i18n, part.status)}</Field>}
            <Field label={t("columns.price")}>{formatPrice(i18n, part)}</Field>
            {part.admin && <Field label={t("columns.quality")}>{qualityLabel(i18n, part.quality)}</Field>}
            <Field label={t("part.manufacturerCode")}>{part.manufacturerCode}</Field>
            <Field label={t("part.visibleCode")}>{part.visibleCode}</Field>
            <Field label={t("part.otherCode")}>{part.otherCode}</Field>
            <Field label={t("part.car")}>
              {part.rrrCarId && (
                <>
                  <AppLink href={`/cars/${part.rrrCarId}`} className="font-medium hover:underline">
                    {part.rrrCarId} {carTitle(part)}
                  </AppLink>
                  <br />
                  <span className="text-muted">{carDetails(part)}</span>
                </>
              )}
            </Field>
            <Field label={t("columns.position")}>{positionLabel(i18n, part.positionCode)}</Field>
            <Field label={t("columns.adText")}>{part.notes}</Field>
            <Field label={t("columns.reservedBy")}>{userName(part.reservedByUser)}</Field>
            <Field label={t("columns.reservedAt")}>{part.reservedAt?.slice(0, 10)}</Field>
            {part.admin && (
              <>
                <Field label={t("columns.createdBy")}>{userName(part.createdByUser)}</Field>
                <Field label={t("columns.listedAt")}>{part.listedAt?.slice(0, 10)}</Field>
              </>
            )}
            <Field label="RRR">
              {part.rrrUrl && (
                <a href={part.rrrUrl} target="_blank" rel="noreferrer" className="text-accent-text hover:underline">
                  {t("part.viewListing")}
                </a>
              )}
            </Field>
          </dl>
        </div>
      </div>
      <Suspense>
        <SimilarParts part={part} />
      </Suspense>
    </main>
  );
}

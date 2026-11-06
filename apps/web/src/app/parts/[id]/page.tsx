import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { BackToList } from "@/components/back-to-list";
import { PartGallery } from "@/components/part-gallery";
import { SimilarParts } from "@/components/similar-parts";
import {
  carDetails,
  carTitle,
  formatPrice,
  positionLabel,
  qualityLabel,
  STATUS_LABELS,
  userName,
} from "@/lib/part-format";
import { getPart } from "@/lib/parts";

export async function generateMetadata({ params }: PageProps<"/parts/[id]">): Promise<Metadata> {
  const part = await getPart((await params).id);
  return { title: part?.name ?? "Dalis nerasta" };
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  if (!children) return null;
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-3 py-2 text-sm">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="min-w-0 wrap-break-word whitespace-pre-line">{children}</dd>
    </div>
  );
}

export default async function PartPage({ params }: PageProps<"/parts/[id]">) {
  const part = await getPart((await params).id);
  if (!part) notFound();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-4 md:p-6">
      <BackToList />
      <div>
        <h1 className="text-xl font-semibold">{part.name}</h1>
        {part.categoryPath && <p className="text-sm text-zinc-500">{part.categoryPath}</p>}
      </div>
      {part.deletedAt && (
        <p className="rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Ši dalis pašalinta iš RRR.
        </p>
      )}
      <div className="grid gap-6 md:grid-cols-2">
        <PartGallery urls={part.photoUrls} alt={part.name} />
        <dl className="divide-y divide-zinc-100 dark:divide-zinc-900">
          <Field label="ID">{part.rrrId}</Field>
          <Field label="Statusas">{STATUS_LABELS[part.status]}</Field>
          <Field label="Kaina">{formatPrice(part)}</Field>
          <Field label="Kokybė">{qualityLabel(part.quality)}</Field>
          <Field label="Gamintojo kodas">{part.manufacturerCode}</Field>
          <Field label="Matomas kodas">{part.visibleCode}</Field>
          <Field label="Kitas kodas">{part.otherCode}</Field>
          <Field label="Automobilis">
            {part.rrrCarId && (
              <>
                <span className="font-medium">
                  {part.rrrCarId} {carTitle(part)}
                </span>
                <br />
                <span className="text-zinc-500">{carDetails(part)}</span>
              </>
            )}
          </Field>
          <Field label="Kita informacija">{positionLabel(part.positionCode)}</Field>
          <Field label="Vieta (kodas)">{part.placeCode}</Field>
          <Field label="Skelbimo tekstas">{part.notes}</Field>
          <Field label="Vidinė pastaba">{part.internalNotes}</Field>
          <Field label="Rezervavo">{userName(part.reservedByUser)}</Field>
          <Field label="Rezervacijos data">{part.reservedAt?.slice(0, 10)}</Field>
          <Field label="Sukūrė">{userName(part.createdByUser)}</Field>
          <Field label="Pridėta">{part.listedAt?.slice(0, 10)}</Field>
          <Field label="RRR">
            {part.rrrUrl && (
              <a href={part.rrrUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                Žiūrėti skelbimą
              </a>
            )}
          </Field>
        </dl>
      </div>
      <Suspense>
        <SimilarParts part={part} />
      </Suspense>
    </main>
  );
}

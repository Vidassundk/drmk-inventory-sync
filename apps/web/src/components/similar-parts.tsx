import Link from "next/link";
import { PartCover } from "@/components/part-cover";
import { formatPrice, itemCount, STATUS_LABELS } from "@/lib/part-format";
import { listSimilarParts } from "@/lib/parts";
import { similarPartsHref } from "@/lib/parts-query";

const SHOWN = 12;

type Props = { part: { id: string; categoryId: number | null; carModelId: number | null } };

export async function SimilarParts({ part }: Props) {
  const { rows, total } = await listSimilarParts(part, SHOWN);
  if (total === 0 || !part.categoryId || !part.carModelId) return null;

  return (
    <section className="flex flex-col gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">Panašios dalys sandėlyje ({itemCount(total)})</h2>
        {total > SHOWN && (
          <Link
            href={similarPartsHref(part.categoryId, part.carModelId)}
            className="text-sm text-blue-600 hover:underline"
          >
            Rodyti visas
          </Link>
        )}
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((similar) => (
          <li key={similar.id} className="flex gap-3 text-sm">
            <PartCover src={similar.coverUrl} alt={similar.name} photoCount={similar.photoCount} />
            <div className="min-w-0">
              <Link href={`/parts/${similar.id}`} className="font-medium hover:underline">
                {similar.name}
              </Link>
              <div className="text-xs text-zinc-500 tabular-nums">
                {[similar.rrrId, similar.carYear, STATUS_LABELS[similar.status]].filter(Boolean).join(" · ")}
              </div>
              <div className="tabular-nums">{formatPrice(similar)}</div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

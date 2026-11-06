import { AppLink } from "@/components/app-link";
import { PartCover } from "@/components/part-cover";
import { getI18n } from "@/lib/i18n-server";
import { formatPrice, statusLabel } from "@/lib/part-format";
import { listSimilarParts } from "@/lib/parts";
import { similarPartsHref } from "@/lib/parts-query";

const SHOWN = 12;

type Props = { part: { id: string; categoryId: number | null; carModelId: number | null } };

export async function SimilarParts({ part }: Props) {
  const i18n = await getI18n();
  const { t, count } = i18n;
  const { rows, total } = await listSimilarParts(part, SHOWN);
  if (total === 0 || !part.categoryId || !part.carModelId) return null;

  return (
    <section className="flex flex-col gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">{t("similar.title", { items: count("items", total) })}</h2>
        {total > SHOWN && (
          <AppLink
            href={similarPartsHref(part.categoryId, part.carModelId)}
            className="text-sm text-accent-text hover:underline"
          >
            {t("similar.showAll")}
          </AppLink>
        )}
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((similar) => (
          <li key={similar.id} className="flex gap-3 text-sm">
            <PartCover src={similar.coverUrl} alt={similar.name} photoCount={similar.photoCount} />
            <div className="min-w-0">
              <AppLink href={`/parts/${similar.id}`} className="font-medium hover:underline">
                {similar.name}
              </AppLink>
              <div className="text-xs text-zinc-500 tabular-nums">
                {[similar.rrrId, similar.carYear, statusLabel(i18n, similar.status)].filter(Boolean).join(" · ")}
              </div>
              <div className="tabular-nums">{formatPrice(i18n, similar)}</div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

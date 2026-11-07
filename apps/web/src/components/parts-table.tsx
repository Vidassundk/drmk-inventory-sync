import type { ReactNode } from "react";
import { AppLink } from "@/components/app-link";
import { CodePill } from "@/components/code-pill";
import { PartCover } from "@/components/part-cover";
import type { I18n } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n-server";
import type { PartColumnKey } from "@/lib/part-columns";
import { similarPartsHref } from "@/lib/parts-query";
import {
  carDetails,
  carTitle,
  formatPrice,
  positionLabel,
  qualityLabel,
  statusLabel,
  userName,
} from "@/lib/part-format";
import type { PartRow } from "@/lib/parts";

const NOWRAP = "whitespace-nowrap";
const MUTED = "whitespace-nowrap text-muted tabular-nums";

const text = (value: string | null | undefined) => value || "–";

const longText = (value: string | null) =>
  value ? <div className="line-clamp-3 whitespace-pre-line">{value}</div> : "–";

/** How each column renders. `cell` sets the classes on its td, and so its width. */
const CELLS: Record<PartColumnKey, { cell?: string; render: (part: PartRow, i18n: I18n) => ReactNode }> = {
  id: { cell: "font-medium tabular-nums", render: (part) => part.rrrId },
  photo: {
    render: (part) => <PartCover src={part.coverUrl} alt={part.name} photoCount={part.photoCount} />,
  },
  part: {
    cell: "min-w-48 max-w-64",
    render: (part) => (
      <>
        <AppLink href={`/parts/${part.id}`} className="font-medium hover:underline">
          {part.name}
        </AppLink>
        {part.category && part.category !== part.name && <div className="text-xs text-muted">{part.category}</div>}
      </>
    ),
  },
  codes: {
    cell: "whitespace-nowrap",
    render: (part) => {
      // A part can repeat one code across its code fields.
      const codes = [
        ...new Set([part.manufacturerCode, part.visibleCode, part.otherCode].filter((code) => code !== null)),
      ];
      return (
        <div className="flex flex-col items-start gap-1">
          {codes.map((code, index) => (
            <CodePill key={code} code={code} primary={index === 0} />
          ))}
        </div>
      );
    },
  },
  price: { cell: "whitespace-nowrap tabular-nums", render: (part, i18n) => formatPrice(i18n, part) },
  stock: {
    cell: "whitespace-nowrap tabular-nums",
    render: ({ stock, categoryId, carModelId, currency }, i18n) =>
      stock && categoryId && carModelId ? (
        <>
          <AppLink href={similarPartsHref(categoryId, carModelId)} className="text-accent-text hover:underline">
            {i18n.count("items", stock.count)}
          </AppLink>
          <div className="text-xs text-muted">{formatPrice(i18n, { price: stock.averagePrice, currency })}</div>
        </>
      ) : (
        "–"
      ),
  },
  car: {
    cell: "min-w-64 max-w-72",
    render: (part) =>
      part.rrrCarId ? (
        <>
          <div className="font-medium">
            <span className="mr-1.5 rounded bg-zinc-100 px-1 text-xs font-normal text-muted tabular-nums dark:bg-zinc-900">
              {part.rrrCarId}
            </span>
            {carTitle(part)}
          </div>
          <div className="text-xs text-muted">{carDetails(part)}</div>
        </>
      ) : (
        "–"
      ),
  },
  position: { cell: NOWRAP, render: (part, i18n) => text(positionLabel(i18n, part.positionCode)) },
  quality: { cell: NOWRAP, render: (part, i18n) => qualityLabel(i18n, part.quality) },
  adText: { cell: "min-w-40 max-w-64", render: (part) => longText(part.notes) },
  status: { cell: NOWRAP, render: (part, i18n) => statusLabel(i18n, part.status) },
  reservedBy: { cell: NOWRAP, render: (part) => text(userName(part.reservedByUser)) },
  reservedAt: { cell: MUTED, render: (part) => text(part.reservedAt?.slice(0, 10)) },
  createdBy: { cell: NOWRAP, render: (part) => text(userName(part.createdByUser)) },
  listedAt: { cell: MUTED, render: (part) => part.listedAt?.slice(0, 10) },
};

export async function PartsTable({ rows, columns }: { rows: PartRow[]; columns: PartColumnKey[] }) {
  const i18n = await getI18n();

  if (rows.length === 0) {
    return <p className="py-16 text-center text-sm text-muted">{i18n.t("parts.empty")}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-max min-w-full text-left text-sm">
        <thead className="border-b border-zinc-200 text-xs text-muted dark:border-zinc-800">
          <tr>
            {columns.map((key) => (
              <th key={key} scope="col" className="px-3 py-2 font-medium whitespace-nowrap">
                {i18n.t(`columns.${key}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
          {rows.map((part) => (
            <tr key={part.id} className="align-top">
              {columns.map((key) => (
                <td key={key} className={`px-3 py-2 ${CELLS[key].cell ?? ""}`}>
                  {CELLS[key].render(part, i18n)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

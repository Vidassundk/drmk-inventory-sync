import type { ReactNode } from "react";
import Link from "next/link";
import { CodePill } from "@/components/code-pill";
import { PartCover } from "@/components/part-cover";
import { columnOf, type PartColumnKey } from "@/lib/part-columns";
import { similarPartsHref } from "@/lib/parts-query";
import {
  carDetails,
  carTitle,
  formatPrice,
  itemCount,
  positionLabel,
  qualityLabel,
  STATUS_LABELS,
  userName,
} from "@/lib/part-format";
import type { PartRow } from "@/lib/parts";

const NOWRAP = "whitespace-nowrap";
const MUTED = "whitespace-nowrap text-zinc-500 tabular-nums";

const text = (value: string | null | undefined) => value || "–";

const longText = (value: string | null) =>
  value ? <div className="line-clamp-3 whitespace-pre-line">{value}</div> : "–";

/** How each column renders. `cell` sets the classes on its td, and so its width. */
const CELLS: Record<PartColumnKey, { cell?: string; render: (part: PartRow) => ReactNode }> = {
  id: { cell: "font-medium tabular-nums", render: (part) => part.rrrId },
  photo: {
    render: (part) => <PartCover src={part.coverUrl} alt={part.name} photoCount={part.photoCount} />,
  },
  part: {
    cell: "min-w-48 max-w-64",
    render: (part) => (
      <>
        <Link href={`/parts/${part.id}`} className="font-medium hover:underline">
          {part.name}
        </Link>
        {part.category && part.category !== part.name && <div className="text-xs text-zinc-500">{part.category}</div>}
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
  price: { cell: "whitespace-nowrap tabular-nums", render: formatPrice },
  stock: {
    cell: "whitespace-nowrap tabular-nums",
    render: ({ stock, categoryId, carModelId, currency }) =>
      stock && categoryId && carModelId ? (
        <>
          <Link href={similarPartsHref(categoryId, carModelId)} className="text-blue-600 hover:underline">
            {itemCount(stock.count)}
          </Link>
          <div className="text-xs text-zinc-500">{formatPrice({ price: stock.averagePrice, currency })}</div>
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
            <span className="mr-1.5 rounded bg-zinc-100 px-1 text-xs font-normal text-zinc-500 tabular-nums dark:bg-zinc-900">
              {part.rrrCarId}
            </span>
            {carTitle(part)}
          </div>
          <div className="text-xs text-zinc-500">{carDetails(part)}</div>
        </>
      ) : (
        "–"
      ),
  },
  position: { cell: NOWRAP, render: (part) => text(positionLabel(part.positionCode)) },
  quality: { cell: NOWRAP, render: (part) => qualityLabel(part.quality) },
  adText: { cell: "min-w-40 max-w-64", render: (part) => longText(part.notes) },
  status: { cell: NOWRAP, render: (part) => STATUS_LABELS[part.status] },
  reservedBy: { cell: NOWRAP, render: (part) => text(userName(part.reservedByUser)) },
  reservedAt: { cell: MUTED, render: (part) => text(part.reservedAt?.slice(0, 10)) },
  createdBy: { cell: NOWRAP, render: (part) => text(userName(part.createdByUser)) },
  listedAt: { cell: MUTED, render: (part) => part.listedAt?.slice(0, 10) },
};

export function PartsTable({ rows, columns }: { rows: PartRow[]; columns: PartColumnKey[] }) {
  if (rows.length === 0) {
    return <p className="py-16 text-center text-sm text-zinc-500">Dalių nerasta.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-max min-w-full text-left text-sm">
        <thead className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800">
          <tr>
            {columns.map((key) => (
              <th key={key} scope="col" className="px-3 py-2 font-medium whitespace-nowrap">
                {columnOf(key).label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
          {rows.map((part) => (
            <tr key={part.id} className="align-top">
              {columns.map((key) => (
                <td key={key} className={`px-3 py-2 ${CELLS[key].cell ?? ""}`}>
                  {CELLS[key].render(part)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

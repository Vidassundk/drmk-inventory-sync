import Link from "next/link";
import { PAGE_SIZES, partsHref, type PartsQuery } from "@/lib/parts-query";

function PageLink({
  query,
  page,
  label,
  disabled,
}: {
  query: PartsQuery;
  page: number;
  label: string;
  disabled: boolean;
}) {
  const className = "rounded border border-zinc-300 px-2.5 py-1 dark:border-zinc-700";
  if (disabled) return <span className={`${className} opacity-40`}>{label}</span>;
  return (
    <Link href={partsHref(query, { page })} className={`${className} hover:bg-zinc-100 dark:hover:bg-zinc-900`}>
      {label}
    </Link>
  );
}

export function PartsPagination({ query, total }: { query: PartsQuery; total: number }) {
  const { page, pageSize } = query;
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : Math.min((page - 1) * pageSize + 1, total);
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-500">
      <div className="flex items-center gap-2">
        <span>Eilučių puslapyje:</span>
        {PAGE_SIZES.map((size) => (
          <Link
            key={size}
            href={partsHref(query, { pageSize: size, page: 1 })}
            aria-current={size === pageSize ? "true" : undefined}
            className="rounded px-1.5 py-0.5 aria-[current=true]:bg-zinc-100 aria-[current=true]:font-medium aria-[current=true]:text-foreground dark:aria-[current=true]:bg-zinc-900"
          >
            {size}
          </Link>
        ))}
      </div>
      <div className="flex items-center gap-2 tabular-nums">
        <span>
          {from.toLocaleString("lt-LT")}–{to.toLocaleString("lt-LT")} iš {total.toLocaleString("lt-LT")}
        </span>
        <PageLink query={query} page={1} label="«" disabled={page <= 1} />
        <PageLink query={query} page={page - 1} label="‹" disabled={page <= 1} />
        <PageLink query={query} page={page + 1} label="›" disabled={page >= lastPage} />
        <PageLink query={query} page={lastPage} label="»" disabled={page >= lastPage} />
      </div>
    </div>
  );
}

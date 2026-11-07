import { AppLink } from "@/components/app-link";
import { getI18n } from "@/lib/i18n-server";
import { PAGE_SIZES } from "@/lib/parts-query";

type HrefFor = (changes: { page?: number; pageSize?: number }) => string;

function PageLink({
  hrefFor,
  page,
  label,
  disabled,
}: {
  hrefFor: HrefFor;
  page: number;
  label: string;
  disabled: boolean;
}) {
  const className = "rounded border border-zinc-300 px-2.5 py-1 dark:border-zinc-700";
  if (disabled) return <span className={`${className} opacity-40`}>{label}</span>;
  return (
    <AppLink href={hrefFor({ page })} className={`${className} hover:bg-zinc-100 dark:hover:bg-zinc-900`}>
      {label}
    </AppLink>
  );
}

type PaginationProps = { page: number; pageSize: number; total: number; hrefFor: HrefFor };

/** Page links and page size for any list; `hrefFor` builds that list's URL with the page or size changed. */
export async function Pagination({ page, pageSize, total, hrefFor }: PaginationProps) {
  const { t, intlLocale } = await getI18n();
  const number = (value: number) => value.toLocaleString(intlLocale);
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : Math.min((page - 1) * pageSize + 1, total);
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-500">
      <div className="flex items-center gap-2">
        <span>{t("pagination.rowsPerPage")}</span>
        {PAGE_SIZES.map((size) => (
          <AppLink
            key={size}
            href={hrefFor({ pageSize: size, page: 1 })}
            aria-current={size === pageSize ? "true" : undefined}
            className="rounded px-1.5 py-0.5 aria-[current=true]:bg-zinc-100 aria-[current=true]:font-medium aria-[current=true]:text-foreground dark:aria-[current=true]:bg-zinc-900"
          >
            {size}
          </AppLink>
        ))}
      </div>
      <div className="flex items-center gap-2 tabular-nums">
        <span>{t("pagination.range", { from: number(from), to: number(to), total: number(total) })}</span>
        <PageLink hrefFor={hrefFor} page={1} label="«" disabled={page <= 1} />
        <PageLink hrefFor={hrefFor} page={page - 1} label="‹" disabled={page <= 1} />
        <PageLink hrefFor={hrefFor} page={page + 1} label="›" disabled={page >= lastPage} />
        <PageLink hrefFor={hrefFor} page={lastPage} label="»" disabled={page >= lastPage} />
      </div>
    </div>
  );
}

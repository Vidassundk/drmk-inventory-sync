import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AutoRefresh } from "@/components/auto-refresh";
import { getI18n } from "@/lib/i18n-server";
import type { I18n, MessageKey } from "@/lib/i18n";
import { getSyncStatus, type Health, type SyncRun } from "@/lib/sync-status";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("sync.title") };
}

/** "5 min ago", in the viewer's language. */
function ago({ intlLocale }: I18n, date: Date | null) {
  if (!date) return "–";
  const seconds = (date.getTime() - Date.now()) / 1000;
  const format = new Intl.RelativeTimeFormat(intlLocale, { numeric: "auto" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, size] of units)
    if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
  return format.format(Math.round(seconds), "second");
}

function duration(run: SyncRun) {
  const ms = (run.finishedAt ?? new Date()).getTime() - run.startedAt.getTime();
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
}

const HEALTH_DOT: Record<Health, string> = {
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  bad: "bg-red-600",
};

function Progress({
  i18n,
  label,
  value,
  total,
  detail,
}: {
  i18n: I18n;
  label: string;
  value: number;
  total: number | null;
  detail?: ReactNode;
}) {
  const number = new Intl.NumberFormat(i18n.intlLocale);
  const percent = total ? Math.min(100, (value / total) * 100) : null;
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-semibold">{label}</h2>
        {percent !== null && (
          <span className="text-sm font-medium tabular-nums">{percent.toFixed(percent >= 99.95 ? 0 : 1)} %</span>
        )}
      </div>
      {/* Only with a total to measure against: a count on its own, like cars, gets no bar. */}
      {percent !== null && (
        <div
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={total ?? undefined}
          aria-valuenow={value}
          className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900"
        >
          <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${percent}%` }} />
        </div>
      )}
      <p className="text-sm tabular-nums">
        {number.format(value)}
        {total !== null && <span className="text-muted"> / {number.format(total)}</span>}
      </p>
      {detail && <div className="text-sm text-muted">{detail}</div>}
    </section>
  );
}

function HealthRow({ health, label, children }: { health: Health; label: string; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3 py-2 text-sm">
      <span className={`mt-1.5 size-2 shrink-0 rounded-full ${HEALTH_DOT[health]}`} aria-hidden="true" />
      <span className="w-40 shrink-0 font-medium">{label}</span>
      <span className="min-w-0 text-muted">{children}</span>
    </li>
  );
}

function runSummary(i18n: I18n, run: SyncRun | undefined) {
  if (!run) return i18n.t("sync.never");
  const { t } = i18n;
  const status = t(`sync.status.${run.status}` as MessageKey);
  if (run.status === "failed") return `${status} ${ago(i18n, run.finishedAt)}: ${run.error?.split("\n")[0] ?? ""}`;
  return `${status} ${ago(i18n, run.finishedAt)} · ${t("sync.seenChanged", {
    seen: run.stats.seen ?? 0,
    changed: (run.stats.inserted ?? 0) + (run.stats.updated ?? 0),
    removed: run.stats.removed ?? 0,
  })}`;
}

export default async function SyncPage() {
  const i18n = await getI18n();
  const { t } = i18n;
  const status = await getSyncStatus();
  const { parts, photos, covers, cars, health, running, recent } = status;
  const number = new Intl.NumberFormat(i18n.intlLocale);
  const date = new Intl.DateTimeFormat(i18n.intlLocale, { dateStyle: "medium" });
  const time = new Intl.DateTimeFormat(i18n.intlLocale, { dateStyle: "short", timeStyle: "short" });
  const fullRun = running.find((run) => run.kind === "full");

  return (
    <main className="flex w-full max-w-5xl flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">{t("sync.title")}</h1>
          <p className="text-sm text-muted">{t("sync.intro")}</p>
        </div>
        {/* Every 10 seconds while a job is running, every minute otherwise. */}
        <AutoRefresh seconds={running.length > 0 ? 10 : 60} />
      </div>

      {running.map((run) => (
        <p
          key={run.id}
          className="flex items-center gap-2 rounded-md bg-zinc-100 px-3 py-2 text-sm dark:bg-zinc-900"
          role="status"
        >
          <span className="size-2 animate-pulse rounded-full bg-accent" aria-hidden="true" />
          {t(`sync.kind.${run.kind}` as MessageKey)} · {t("sync.runningFor", { time: duration(run) })}
          {run.kind === "full" &&
            run.stats.total &&
            ` · ${number.format(run.stats.seen ?? 0)} / ${number.format(run.stats.total)}`}
        </p>
      ))}

      <div className="grid gap-4 md:grid-cols-2">
        {fullRun?.stats.total ? (
          <Progress
            i18n={i18n}
            label={t("sync.fullProgress")}
            value={fullRun.stats.seen ?? 0}
            total={fullRun.stats.total}
          />
        ) : null}
        <Progress
          i18n={i18n}
          label={t("sync.parts")}
          value={parts.live}
          total={parts.rrrTotal}
          detail={
            <>
              {parts.rrrTotal === null ? t("sync.partsNoTotal") : t("sync.partsHint")}{" "}
              {t("sync.partsRemoved", { count: number.format(parts.removed) })}
            </>
          }
        />
        <Progress
          i18n={i18n}
          label={t("sync.photos")}
          value={photos.stored}
          total={photos.total}
          detail={
            <>
              {t("sync.photosWaiting", { count: number.format(photos.pending) })}
              {photos.failed > 0 && ` · ${t("sync.photosFailed", { count: number.format(photos.failed) })}`}
              {photos.doneAt && ` · ${t("sync.photosDoneBy", { date: date.format(photos.doneAt) })}`}
            </>
          }
        />
        <Progress
          i18n={i18n}
          label={t("sync.covers")}
          value={covers.stored}
          total={covers.total}
          detail={t("sync.coversHint")}
        />
        <Progress
          i18n={i18n}
          label={t("sync.cars")}
          value={cars.total}
          total={null}
          detail={t("sync.carsChanged", { time: ago(i18n, cars.lastChangedAt) })}
        />
      </div>

      <section>
        <h2 className="mb-1 font-semibold">{t("sync.health")}</h2>
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
          <HealthRow health={health.incremental.health} label={t("sync.kind.incremental")}>
            {runSummary(i18n, health.incremental.run)}
          </HealthRow>
          <HealthRow health={health.full.health} label={t("sync.kind.full")}>
            {runSummary(i18n, health.full.run)}
          </HealthRow>
          <HealthRow health={health.photos.health} label={t("sync.photos")}>
            {t("sync.photosLast", {
              time: ago(i18n, health.photos.lastStoredAt),
              count: number.format(photos.storedToday),
            })}
          </HealthRow>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">{t("sync.recent")}</h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-max min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs text-muted dark:border-zinc-800">
              <tr>
                {(
                  [
                    "sync.col.kind",
                    "sync.col.status",
                    "sync.col.started",
                    "sync.col.duration",
                    "sync.col.changes",
                  ] as const
                ).map((key) => (
                  <th key={key} scope="col" className="px-3 py-2 font-medium">
                    {t(key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
              {recent.map((run) => (
                <tr key={run.id} className="align-top">
                  <td className="px-3 py-2 whitespace-nowrap">{t(`sync.kind.${run.kind}` as MessageKey)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="inline-flex items-center gap-2">
                      <span
                        className={`size-2 rounded-full ${HEALTH_DOT[run.status === "failed" ? "bad" : run.status === "running" ? "warn" : "ok"]}`}
                        aria-hidden="true"
                      />
                      {t(`sync.status.${run.status}` as MessageKey)}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums">{time.format(run.startedAt)}</td>
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums">{duration(run)}</td>
                  <td className="max-w-md px-3 py-2 text-muted">
                    {run.status === "failed"
                      ? run.error?.split("\n")[0]
                      : t("sync.seenChanged", {
                          seen: run.stats.seen ?? 0,
                          changed: (run.stats.inserted ?? 0) + (run.stats.updated ?? 0),
                          removed: run.stats.removed ?? 0,
                        })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

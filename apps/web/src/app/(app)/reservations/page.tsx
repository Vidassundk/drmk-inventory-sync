import type { Metadata } from "next";
import { AppLink } from "@/components/app-link";
import { PartCover } from "@/components/part-cover";
import { ReservationControl } from "@/components/reservation-control";
import { CancelRequestButton, RequestActions } from "@/components/reservation-requests";
import { getI18n } from "@/lib/i18n-server";
import type { I18n } from "@/lib/i18n";
import { carTitle, formatPrice } from "@/lib/part-format";
import {
  listClients,
  listMyRequests,
  listMyReservations,
  listRequests,
  listReservationGroups,
  type Client,
  type RequestedPart,
  type ReservationGroup,
  type ReservedPart,
} from "@/lib/reservations";
import { viewerIsAdmin } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("reservations.title") };
}

const money = (i18n: I18n, value: number) =>
  new Intl.NumberFormat(i18n.intlLocale, { style: "currency", currency: "EUR" }).format(value);

/** The parts on one list. Admins get the reservation control on each row; guests only look. */
function ReservedTable({
  i18n,
  rows,
  clients,
}: {
  i18n: I18n;
  rows: ReservedPart[];
  /** Given to admins only. */
  clients?: Client[];
}) {
  const { t } = i18n;
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-max min-w-full text-left text-sm">
        <thead className="border-b border-zinc-200 text-xs text-muted dark:border-zinc-800">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">
              {t("columns.id")}
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              {t("columns.photo")}
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              {t("columns.part")}
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              {t("columns.price")}
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              {t("reservations.since")}
            </th>
            {clients && <th scope="col" className="px-3 py-2" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
          {rows.map((part) => (
            <tr key={part.id} className="align-top">
              <td className="px-3 py-2 font-medium tabular-nums">{part.rrrId}</td>
              <td className="px-3 py-2">
                <PartCover src={part.coverUrl} alt={part.name} photoCount={part.photoCount} />
              </td>
              <td className="max-w-72 px-3 py-2">
                <AppLink href={`/parts/${part.id}`} className="font-medium hover:underline">
                  {part.name}
                </AppLink>
                {part.rrrCarId && <p className="text-xs text-muted">{carTitle(part)}</p>}
              </td>
              <td className="px-3 py-2 whitespace-nowrap tabular-nums">{formatPrice(i18n, part)}</td>
              <td className="px-3 py-2 whitespace-nowrap tabular-nums">{part.reservedAt ?? "–"}</td>
              {clients && (
                <td className="px-3 py-2">
                  <ReservationControl partId={part.id} reserved clientId={part.clientId} clients={clients} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Open requests. Admins see who asked and can approve or decline; guests can take theirs back. */
function RequestTable({ i18n, rows, admin }: { i18n: I18n; rows: RequestedPart[]; admin: boolean }) {
  const { t } = i18n;
  const headings = [
    t("columns.id"),
    t("columns.photo"),
    t("columns.part"),
    t("columns.price"),
    ...(admin ? [t("reservations.client")] : []),
    t("reservations.requests.requestedAt"),
  ];
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-max min-w-full text-left text-sm">
        <thead className="border-b border-zinc-200 text-xs text-muted dark:border-zinc-800">
          <tr>
            {headings.map((heading) => (
              <th key={heading} scope="col" className="px-3 py-2 font-medium">
                {heading}
              </th>
            ))}
            <th scope="col" className="px-3 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
          {rows.map((part) => (
            <tr key={`${part.id}:${part.clientId}`} className="align-top">
              <td className="px-3 py-2 font-medium tabular-nums">{part.rrrId}</td>
              <td className="px-3 py-2">
                <PartCover src={part.coverUrl} alt={part.name} photoCount={part.photoCount} />
              </td>
              <td className="max-w-72 px-3 py-2">
                <AppLink href={`/parts/${part.id}`} className="font-medium hover:underline">
                  {part.name}
                </AppLink>
                {part.rrrCarId && <p className="text-xs text-muted">{carTitle(part)}</p>}
              </td>
              <td className="px-3 py-2 whitespace-nowrap tabular-nums">{formatPrice(i18n, part)}</td>
              {admin && (
                <td className="px-3 py-2">
                  <p className="font-medium">{part.clientName}</p>
                  <p className="text-xs text-muted">{part.clientEmail}</p>
                </td>
              )}
              <td className="px-3 py-2 whitespace-nowrap tabular-nums">{part.requestedAt}</td>
              <td className="px-3 py-2">
                {admin ? (
                  <RequestActions partId={part.id} userId={part.clientId} />
                ) : (
                  <CancelRequestButton partId={part.id} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Admins: open requests first, then every reserved part, grouped by client. */
async function AdminReservations({ i18n }: { i18n: I18n }) {
  const { t } = i18n;
  const [requests, groups, clients] = await Promise.all([listRequests(), listReservationGroups(), listClients()]);

  return (
    <>
      {requests.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="flex flex-wrap items-baseline gap-x-3">
            <span className="font-semibold">{t("reservations.requests.title")}</span>
            <span className="text-sm text-muted">{i18n.count("items", requests.length)}</span>
          </h2>
          <p className="text-sm text-muted">{t("reservations.requests.intro")}</p>
          <RequestTable i18n={i18n} rows={requests} admin />
        </section>
      )}
      {groups.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">{t("reservations.empty")}</p>
      ) : (
        <ReservationGroups i18n={i18n} groups={groups} clients={clients} />
      )}
    </>
  );
}

function ReservationGroups({ i18n, groups, clients }: { i18n: I18n; groups: ReservationGroup[]; clients: Client[] }) {
  const { t } = i18n;
  return groups.map((group) => (
    <section key={group.clientId ?? "none"} className="flex flex-col gap-2">
      <h2 className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-semibold">{group.clientName ?? t("reservations.noClient.title")}</span>
        {group.clientEmail && <span className="text-sm text-muted">{group.clientEmail}</span>}
        <span className="text-sm text-muted">
          {i18n.count("items", group.parts.length)} · {money(i18n, group.total)}
        </span>
      </h2>
      {group.clientId === null && <p className="text-sm text-muted">{t("reservations.noClient.hint")}</p>}
      <ReservedTable i18n={i18n} rows={group.parts} clients={clients} />
    </section>
  ));
}

/** Guests: what they've asked for, then the parts set aside for them. */
async function MyReservations({ i18n }: { i18n: I18n }) {
  const { t } = i18n;
  const [requests, rows] = await Promise.all([listMyRequests(), listMyReservations()]);
  if (requests.length === 0 && rows.length === 0)
    return <p className="py-16 text-center text-sm text-muted">{t("reservations.mineEmpty")}</p>;
  const total = rows.reduce((sum, part) => sum + Number(part.price ?? 0), 0);
  return (
    <>
      {requests.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="flex flex-wrap items-baseline gap-x-3">
            <span className="font-semibold">{t("reservations.mine.pending")}</span>
            <span className="text-sm text-muted">{i18n.count("items", requests.length)}</span>
          </h2>
          <p className="text-sm text-muted">{t("reservations.mine.pendingHint")}</p>
          <RequestTable i18n={i18n} rows={requests} admin={false} />
        </section>
      )}
      {rows.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="flex flex-wrap items-baseline gap-x-3">
            <span className="font-semibold">{t("reservations.mine.reserved")}</span>
            <span className="text-sm text-muted">
              {i18n.count("items", rows.length)} · {money(i18n, total)}
            </span>
          </h2>
          <ReservedTable i18n={i18n} rows={rows} />
        </section>
      )}
    </>
  );
}

export default async function ReservationsPage() {
  const i18n = await getI18n();
  const admin = await viewerIsAdmin();

  return (
    <main className="flex w-full flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold">{i18n.t("reservations.title")}</h1>
        <p className="text-sm text-muted">{i18n.t(admin ? "reservations.intro" : "reservations.mineIntro")}</p>
      </div>
      {admin ? <AdminReservations i18n={i18n} /> : <MyReservations i18n={i18n} />}
    </main>
  );
}

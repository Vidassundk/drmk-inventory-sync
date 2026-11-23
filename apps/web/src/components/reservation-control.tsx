"use client";

import { useState, useTransition } from "react";
import { releasePart, reservePart, type ReservationResult } from "@/app/(app)/reservations/actions";
import { useI18n } from "@/components/i18n-provider";
import { statusLabel } from "@/lib/part-format";
import type { Client } from "@/lib/reservations";

const FIELD =
  "min-w-0 rounded-md border border-zinc-300 bg-background px-2 py-1.5 text-sm outline-none focus:border-accent dark:border-zinc-700";
const PRIMARY =
  "rounded-md bg-accent px-3 py-1.5 text-sm font-medium whitespace-nowrap text-white hover:opacity-90 disabled:opacity-60";
const SECONDARY =
  "rounded-md border border-zinc-300 px-3 py-1.5 text-sm whitespace-nowrap hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900";

/**
 * Reserve a part for a guest, move it to another guest, or put it back in stock. Each one checks the part on RRR
 * first and changes it there too. Admins only.
 */
export function ReservationControl({
  partId,
  reserved,
  clientId,
  clients,
}: {
  partId: string;
  reserved: boolean;
  /** Who it's reserved for; null if it's in stock or reserved with no client yet. */
  clientId: string | null;
  clients: Client[];
}) {
  const i18n = useI18n();
  const { t } = i18n;
  const [busy, startTransition] = useTransition();
  const [choice, setChoice] = useState(clientId ?? "");
  const [result, setResult] = useState<ReservationResult | null>(null);

  const run = (action: () => Promise<ReservationResult>) =>
    startTransition(async () => {
      try {
        setResult(await action());
      } catch {
        setResult({ error: "reservations.rrrFailed" });
      }
    });

  const message = result && (result.error ?? result.ok);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={choice}
          onChange={(event) => setChoice(event.target.value)}
          disabled={busy}
          aria-label={t("reservations.client")}
          className={FIELD}
        >
          <option value="" disabled>
            {t("reservations.chooseClient")}
          </option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name} ({client.email})
            </option>
          ))}
        </select>
        {!reserved && (
          <button
            type="button"
            disabled={busy || !choice}
            onClick={() => run(() => reservePart(partId, choice))}
            className={PRIMARY}
          >
            {t(busy ? "reservations.working" : "reservations.reserve")}
          </button>
        )}
        {reserved && choice !== (clientId ?? "") && (
          <button
            type="button"
            disabled={busy || !choice}
            onClick={() => run(() => reservePart(partId, choice))}
            className={PRIMARY}
          >
            {t(busy ? "reservations.working" : "reservations.assign")}
          </button>
        )}
        {reserved && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (window.confirm(t("reservations.releaseConfirm"))) run(() => releasePart(partId));
            }}
            className={SECONDARY}
          >
            {t("reservations.release")}
          </button>
        )}
      </div>
      {message && (
        <p role="status" className={`text-sm ${result?.error ? "text-red-700 dark:text-red-300" : "text-muted"}`}>
          {t(message)}
          {result?.status && ` (${statusLabel(i18n, result.status)})`}
        </p>
      )}
    </div>
  );
}

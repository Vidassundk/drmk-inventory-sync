"use client";

import { useState, useTransition } from "react";
import {
  approveRequest,
  cancelRequest,
  declineRequest,
  requestPart,
  type ReservationResult,
} from "@/app/(app)/reservations/actions";
import { useI18n } from "@/components/i18n-provider";
import { statusLabel } from "@/lib/part-format";

const PRIMARY =
  "rounded-md bg-accent px-3 py-1.5 text-sm font-medium whitespace-nowrap text-white hover:opacity-90 disabled:opacity-60";
const SECONDARY =
  "rounded-md border border-zinc-300 px-3 py-1.5 text-sm whitespace-nowrap hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900";

/** Runs one action at a time and keeps its message, so a button can't be pressed twice while RRR answers. */
function useAction() {
  const [busy, startTransition] = useTransition();
  const [result, setResult] = useState<ReservationResult | null>(null);
  const run = (action: () => Promise<ReservationResult>) =>
    startTransition(async () => {
      try {
        setResult(await action());
      } catch {
        setResult({ error: "reservations.rrrFailed" });
      }
    });
  return { busy, result, run };
}

function Message({ result }: { result: ReservationResult | null }) {
  const i18n = useI18n();
  const message = result && (result.error ?? result.ok);
  if (!message) return null;
  return (
    <p role="status" className={`text-sm ${result?.error ? "text-red-700 dark:text-red-300" : "text-muted"}`}>
      {i18n.t(message)}
      {result?.status && ` (${statusLabel(i18n, result.status)})`}
    </p>
  );
}

/** For guests, on a part in stock: ask for it, or take the request back. */
export function RequestButton({ partId, requestedAt }: { partId: string; requestedAt: string | null }) {
  const { t } = useI18n();
  const { busy, result, run } = useAction();

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted">
        {requestedAt ? t("reservations.request.sent", { date: requestedAt }) : t("reservations.request.hint")}
      </p>
      <div>
        {requestedAt ? (
          <button type="button" disabled={busy} onClick={() => run(() => cancelRequest(partId))} className={SECONDARY}>
            {t("reservations.request.cancel")}
          </button>
        ) : (
          <button type="button" disabled={busy} onClick={() => run(() => requestPart(partId))} className={PRIMARY}>
            {t("reservations.request.button")}
          </button>
        )}
      </div>
      {/* Only errors: on success the text above already changes. */}
      {result?.error && <Message result={result} />}
    </div>
  );
}

/** For guests, on their list: take a request back. */
export function CancelRequestButton({ partId }: { partId: string }) {
  const { t } = useI18n();
  const { busy, result, run } = useAction();
  return (
    <div className="flex flex-col gap-1">
      <button type="button" disabled={busy} onClick={() => run(() => cancelRequest(partId))} className={SECONDARY}>
        {t("reservations.request.cancel")}
      </button>
      <Message result={result} />
    </div>
  );
}

/** For admins: approve a guest's request, which reserves the part on RRR, or decline it. */
export function RequestActions({ partId, userId }: { partId: string; userId: string }) {
  const { t } = useI18n();
  const { busy, result, run } = useAction();

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => run(() => approveRequest(partId, userId))}
          className={PRIMARY}
        >
          {t(busy ? "reservations.working" : "reservations.requests.approve")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (window.confirm(t("reservations.requests.declineConfirm"))) run(() => declineRequest(partId, userId));
          }}
          className={SECONDARY}
        >
          {t("reservations.requests.decline")}
        </button>
      </div>
      <Message result={result} />
    </div>
  );
}

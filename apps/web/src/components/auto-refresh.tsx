"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n-provider";

/**
 * Re-renders the page from the server every few seconds while it's on screen, and pauses while the tab is hidden, so
 * an open page follows the sync jobs without anyone pressing refresh.
 */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const { t } = useI18n();
  const router = useRouter();
  const [updatedAt, setUpdatedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = () => {
      setNow(Date.now());
      if (document.visibilityState !== "visible") return;
      if (Date.now() - updatedAt >= seconds * 1000) {
        setUpdatedAt(Date.now());
        router.refresh();
      }
    };
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [router, seconds, updatedAt]);

  return (
    <p className="text-xs text-muted tabular-nums" aria-live="off">
      {t("sync.updated", { seconds: Math.max(0, Math.round((now - updatedAt) / 1000)) })} ·{" "}
      {t("sync.every", { seconds })}
    </p>
  );
}

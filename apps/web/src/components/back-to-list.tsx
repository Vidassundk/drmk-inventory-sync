"use client";

import { useRouter } from "next/navigation";
import { useI18n } from "@/components/i18n-provider";

/** Goes back so the list keeps its tab, search and page. Opened directly from a link, it falls back to the list. */
export function BackToList() {
  const router = useRouter();
  const { t } = useI18n();

  return (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? router.back() : router.push("/parts"))}
      className="self-start text-sm text-muted hover:text-foreground"
    >
      ← {t("parts.title")}
    </button>
  );
}

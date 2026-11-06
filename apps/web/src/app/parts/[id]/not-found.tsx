import { AppLink } from "@/components/app-link";
import { getI18n } from "@/lib/i18n-server";

export default async function PartNotFound() {
  const { t } = await getI18n();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
      <p>{t("part.notFound")}</p>
      <AppLink href="/parts" className="text-sm text-accent-text hover:underline">
        {t("part.backToList")}
      </AppLink>
    </main>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LanguageSwitcher } from "@/components/language-switcher";
import { LoginForm } from "@/components/login-form";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { getI18n } from "@/lib/i18n-server";
import { getSession } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("login.title") };
}

export default async function LoginPage() {
  if (await getSession()) redirect("/parts");
  const { t } = await getI18n();

  return (
    <main className="flex flex-1 flex-col">
      <div className="flex justify-end gap-2 p-4">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
      <div className="flex flex-1 flex-col items-center px-4 pt-[12vh] pb-16">
        <Logo className="mb-8 h-8 w-auto" />
        <div className="w-full max-w-sm rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
          <h1 className="mb-1 text-xl font-semibold">{t("login.title")}</h1>
          <LoginForm />
        </div>
        <p className="mt-6 max-w-sm text-center text-sm text-muted">{t("login.inviteOnly")}</p>
      </div>
    </main>
  );
}

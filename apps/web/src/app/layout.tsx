import { Suspense, ViewTransition } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AppLink } from "@/components/app-link";
import { Geist, Geist_Mono } from "next/font/google";
import { I18nProvider } from "@/components/i18n-provider";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/logo";
import { MainNav } from "@/components/main-nav";
import { PartsSearch } from "@/components/parts-search";
import { ThemeToggle } from "@/components/theme-toggle";
import { getI18n } from "@/lib/i18n-server";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: "Deremika", description: t("app.description") };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Read on the server so the page arrives in the right theme, with no flash of the other one.
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  const { locale, t } = await getI18n();

  return (
    <html lang={locale} data-theme={theme} className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <I18nProvider locale={locale}>
          {/* On wide screens the logo sits in its own square above the sidebar, sharing its border line. */}
          <header className="sticky top-0 z-30 flex flex-wrap items-center gap-x-2 gap-y-3 border-b border-zinc-200 bg-background px-4 py-3.5 md:h-16 md:flex-nowrap md:gap-x-6 md:p-0 md:pr-6 dark:border-zinc-800">
            <AppLink
              href="/parts"
              className="flex items-center border-zinc-200 md:h-full md:w-60 md:shrink-0 md:justify-center md:border-r dark:border-zinc-800"
            >
              <Logo className="h-6 w-auto" />
            </AppLink>
            <div className="order-last w-full md:order-none md:w-auto md:max-w-xl md:flex-1">
              <Suspense>
                <PartsSearch />
              </Suspense>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <LanguageSwitcher />
              <ThemeToggle />
            </div>
          </header>
          <div className="flex flex-1 flex-col md:flex-row">
            <aside className="shrink-0 border-b border-zinc-200 px-4 py-2 md:w-60 md:border-r md:border-b-0 md:px-3 md:py-4 dark:border-zinc-800">
              {/* Stays in view below the sticky header (4rem tall on wide screens) while long lists scroll. */}
              <div className="md:sticky md:top-20">
                <h2 className="hidden px-3 pb-2 text-xs font-medium tracking-wide text-muted uppercase md:block">
                  {t("app.title")}
                </h2>
                <MainNav />
              </div>
            </aside>
            {/* min-w-0 lets wide tables scroll inside the page instead of pushing the sidebar off-screen. */}
            <div className="flex min-w-0 flex-1 flex-col">
              {/* Crossfades on a language change only, so tabs and pagination stay instant. */}
              <ViewTransition default="none" update={{ "language-change": "language-fade", default: "none" }}>
                {children}
              </ViewTransition>
            </div>
          </div>
        </I18nProvider>
      </body>
    </html>
  );
}

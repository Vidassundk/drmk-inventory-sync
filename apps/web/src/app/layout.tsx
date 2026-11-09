import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { I18nProvider } from "@/components/i18n-provider";
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
  const { locale } = await getI18n();

  return (
    <html lang={locale} data-theme={theme} className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}

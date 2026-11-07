"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppLink } from "@/components/app-link";
import { CarsIcon, PartsIcon } from "@/components/icons";
import { useI18n } from "@/components/i18n-provider";

const LINKS: { href: string; label: "nav.parts" | "nav.cars"; icon: ReactNode }[] = [
  { href: "/parts", label: "nav.parts", icon: <PartsIcon /> },
  { href: "/cars", label: "nav.cars", icon: <CarsIcon /> },
];

/** The sidebar: a column on wide screens, a row under the header on phones. */
export function MainNav() {
  const { t } = useI18n();
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 text-sm md:flex-col">
      {LINKS.map(({ href, label, icon }) => (
        <AppLink
          key={href}
          href={href}
          aria-current={pathname.startsWith(href) ? "page" : undefined}
          className="flex items-center gap-2.5 rounded-md px-3 py-2 text-muted hover:bg-zinc-100 hover:text-foreground aria-[current=page]:bg-zinc-100 aria-[current=page]:font-medium aria-[current=page]:text-accent-text dark:hover:bg-zinc-900 dark:aria-[current=page]:bg-zinc-900"
        >
          {icon}
          {t(label)}
        </AppLink>
      ))}
    </nav>
  );
}

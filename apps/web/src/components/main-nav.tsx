"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppLink } from "@/components/app-link";
import { CarsIcon, PartsIcon, UsersIcon } from "@/components/icons";
import { useI18n } from "@/components/i18n-provider";

type NavLink = { href: string; label: "nav.parts" | "nav.cars" | "nav.users"; icon: ReactNode };

const LINKS: NavLink[] = [
  { href: "/parts", label: "nav.parts", icon: <PartsIcon /> },
  { href: "/cars", label: "nav.cars", icon: <CarsIcon /> },
];
const ADMIN_LINKS: NavLink[] = [{ href: "/users", label: "nav.users", icon: <UsersIcon /> }];

/** The sidebar: a column on wide screens, a row under the header on phones. */
export function MainNav({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useI18n();
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 text-sm md:flex-col">
      {(isAdmin ? [...LINKS, ...ADMIN_LINKS] : LINKS).map(({ href, label, icon }) => (
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

"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppLink } from "@/components/app-link";
import { CarsIcon, PartsIcon, UsersIcon } from "@/components/icons";
import { useI18n } from "@/components/i18n-provider";

type NavLink = { href: string; label: "nav.parts" | "nav.cars" | "nav.users"; icon: ReactNode };
type NavSection = { title: "nav.inventory" | "nav.settings"; links: NavLink[] };

const INVENTORY: NavSection = {
  title: "nav.inventory",
  links: [
    { href: "/parts", label: "nav.parts", icon: <PartsIcon /> },
    { href: "/cars", label: "nav.cars", icon: <CarsIcon /> },
  ],
};
const SETTINGS: NavSection = {
  title: "nav.settings",
  links: [{ href: "/users", label: "nav.users", icon: <UsersIcon /> }],
};

/**
 * The sidebar: a column of titled sections on wide screens, a row under the header on phones.
 */
export function MainNav({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const sections = isAdmin ? [INVENTORY, SETTINGS] : [INVENTORY];

  return (
    <nav className="flex gap-1 text-sm md:flex-col md:gap-5">
      {sections.map(({ title, links }, index) => (
        <div
          key={title}
          className={`flex gap-1 md:flex-col ${index > 0 ? "border-l border-zinc-200 pl-1 dark:border-zinc-800 md:border-l-0 md:pl-0" : ""}`}
        >
          <h2 className="hidden px-3 pb-1 text-xs font-medium tracking-wide text-muted uppercase md:block">
            {t(title)}
          </h2>
          {links.map(({ href, label, icon }) => (
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
        </div>
      ))}
    </nav>
  );
}

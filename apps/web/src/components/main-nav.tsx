"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppLink } from "@/components/app-link";
import { useI18n } from "@/components/i18n-provider";

const ICON = "size-4 shrink-0 fill-none stroke-current stroke-[1.5]";

// A gear for parts.
const partsIcon = (
  <svg viewBox="0 0 16 16" aria-hidden="true" className={ICON} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="8" r="2.25" />
    <path d="M8 1.5v1.75M8 12.75v1.75M1.5 8h1.75M12.75 8h1.75M3.4 3.4l1.25 1.25M11.35 11.35l1.25 1.25M3.4 12.6l1.25-1.25M11.35 4.65l1.25-1.25" />
    <circle cx="8" cy="8" r="4.75" />
  </svg>
);

// A car seen from the side.
const carsIcon = (
  <svg viewBox="0 0 16 16" aria-hidden="true" className={ICON} strokeLinecap="round" strokeLinejoin="round">
    <path d="M1.75 10.5V8.25L3.5 5h7.25l2.5 3.25h.5c.55 0 1 .45 1 1v1.25h-1.25" />
    <path d="M5.5 10.5h4.5M1.75 10.5h1" />
    <circle cx="4.25" cy="10.75" r="1.5" />
    <circle cx="11.75" cy="10.75" r="1.5" />
    <path d="M6.75 5v3.25H2.25M6.75 8.25h6.25" />
  </svg>
);

const LINKS: { href: string; label: "nav.parts" | "nav.cars"; icon: ReactNode }[] = [
  { href: "/parts", label: "nav.parts", icon: partsIcon },
  { href: "/cars", label: "nav.cars", icon: carsIcon },
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
          className="flex items-center gap-2.5 rounded-md px-3 py-2 text-zinc-600 hover:bg-zinc-100 hover:text-foreground aria-[current=page]:bg-zinc-100 aria-[current=page]:font-medium aria-[current=page]:text-accent-text dark:text-zinc-400 dark:hover:bg-zinc-900 dark:aria-[current=page]:bg-zinc-900"
        >
          {icon}
          {t(label)}
        </AppLink>
      ))}
    </nav>
  );
}

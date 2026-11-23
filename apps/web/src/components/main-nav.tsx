"use client";

import { useOptimistic, useTransition, type MouseEvent, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AppLink } from "@/components/app-link";
import { CarsIcon, PartsIcon, ReservationsIcon, SyncIcon, UsersIcon } from "@/components/icons";
import { useI18n } from "@/components/i18n-provider";
import { PageLoader } from "@/components/spinner";

type NavLink = {
  href: string;
  label: "nav.parts" | "nav.cars" | "nav.reservations" | "nav.users" | "nav.sync";
  icon: ReactNode;
};
type NavSection = { title: "nav.inventory" | "nav.settings"; links: NavLink[] };

const INVENTORY: NavSection = {
  title: "nav.inventory",
  links: [
    { href: "/parts", label: "nav.parts", icon: <PartsIcon /> },
    { href: "/cars", label: "nav.cars", icon: <CarsIcon /> },
    // Admins see every list; guests see the parts reserved for them.
    { href: "/reservations", label: "nav.reservations", icon: <ReservationsIcon /> },
  ],
};
const SETTINGS: NavSection = {
  title: "nav.settings",
  links: [
    { href: "/users", label: "nav.users", icon: <UsersIcon /> },
    { href: "/sync", label: "nav.sync", icon: <SyncIcon /> },
  ],
};

/**
 * The sidebar: a column of titled sections on wide screens, a row under the header on phones.
 */
export function MainNav({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  // Pages load from the server with no prefetching, so a click would otherwise show nothing until the next page
  // arrives. Instead the item lights up at once and a spinner shows until the page is ready.
  const [pending, startTransition] = useTransition();
  const [current, setCurrent] = useOptimistic(pathname);

  function open(event: MouseEvent<HTMLAnchorElement>, href: string) {
    // Leave new-tab and other modified clicks to the browser.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    startTransition(() => {
      setCurrent(href);
      router.push(href);
    });
  }
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
              onClick={(event) => open(event, href)}
              aria-current={current.startsWith(href) ? "page" : undefined}
              className="flex items-center gap-2.5 rounded-md px-3 py-2 text-muted hover:bg-zinc-100 hover:text-foreground aria-[current=page]:bg-zinc-100 aria-[current=page]:font-medium aria-[current=page]:text-accent-text dark:hover:bg-zinc-900 dark:aria-[current=page]:bg-zinc-900"
            >
              {icon}
              {t(label)}
            </AppLink>
          ))}
        </div>
      ))}
      {pending && <PageLoader label={t("nav.loading")} />}
    </nav>
  );
}

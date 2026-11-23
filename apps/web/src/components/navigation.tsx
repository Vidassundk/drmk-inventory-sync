"use client";

import { createContext, use, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { PageSkeleton } from "@/components/skeletons";

type Navigation = {
  /** The page being opened from the sidebar, until it's ready. */
  pendingHref: string | null;
  go: (href: string) => void;
};

const NavigationContext = createContext<Navigation>({ pendingHref: null, go: () => {} });

export const useNavigation = () => use(NavigationContext);

/**
 * Pages load from the server with no prefetching (see AppLink), so a click would otherwise show nothing until the
 * next page arrives. This lets the sidebar start a navigation and the content area show that page's skeleton at once.
 */
export function NavigationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [target, setTarget] = useState<string | null>(null);

  const go = (href: string) => {
    setTarget(href);
    startTransition(() => router.push(href));
  };

  return <NavigationContext value={{ pendingHref: pending ? target : null, go }}>{children}</NavigationContext>;
}

/** The page, or the skeleton of the page being opened. The current page stays mounted underneath, just hidden. */
export function PageContent({ children }: { children: ReactNode }) {
  const { pendingHref } = useNavigation();
  return (
    <>
      {pendingHref && <PageSkeleton href={pendingHref} />}
      <div hidden={pendingHref !== null} className="flex min-w-0 flex-1 flex-col">
        {children}
      </div>
    </>
  );
}

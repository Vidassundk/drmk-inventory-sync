// Placeholder layouts shown while a page loads, shaped like the page so nothing jumps when it arrives. Plain markup
// with no hooks, so they work both as route loading screens and in the sidebar's instant feedback.
import type { ReactNode } from "react";

const BLOCK = "animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-900";

function Bar({ className }: { className: string }) {
  return <div aria-hidden="true" className={`${BLOCK} ${className}`} />;
}

/** The page frame, with the same padding and width as the real page. */
function Page({ wide = true, gap = "gap-4", children }: { wide?: boolean; gap?: string; children: ReactNode }) {
  return (
    <main aria-busy="true" className={`flex w-full flex-1 flex-col p-4 md:p-6 ${gap} ${wide ? "" : "max-w-5xl"}`}>
      {children}
    </main>
  );
}

function Heading({ intro = false }: { intro?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <Bar className="h-8 w-44" />
      {intro && <Bar className="h-4 w-full max-w-md" />}
    </div>
  );
}

function Rows({ count, height }: { count: number; height: string }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: count }, (_, i) => (
        <Bar key={i} className={height} />
      ))}
    </div>
  );
}

function FilterRow({ chips }: { chips: number }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {Array.from({ length: chips }, (_, i) => (
        <Bar key={i} className="h-8 w-28" />
      ))}
      <div className="ml-auto flex gap-2">
        <Bar className="h-8 w-32" />
        <Bar className="size-8" />
      </div>
    </div>
  );
}

export function PartsSkeleton() {
  return (
    <Page>
      <Heading />
      <div className="flex gap-1 border-b border-zinc-200 pb-2 dark:border-zinc-800">
        {Array.from({ length: 5 }, (_, i) => (
          <Bar key={i} className="h-7 w-20" />
        ))}
      </div>
      <FilterRow chips={2} />
      <Rows count={10} height="h-16" />
    </Page>
  );
}

export function CarsSkeleton() {
  return (
    <Page>
      <Heading />
      <FilterRow chips={3} />
      <Rows count={10} height="h-16" />
    </Page>
  );
}

export function ReservationsSkeleton() {
  return (
    <Page gap="gap-6">
      <Heading intro />
      {[4, 3].map((count, i) => (
        <section key={i} className="flex flex-col gap-2">
          <Bar className="h-6 w-64" />
          <Rows count={count} height="h-16" />
        </section>
      ))}
    </Page>
  );
}

export function UsersSkeleton() {
  return (
    <Page wide={false} gap="gap-6">
      <Heading intro />
      <Bar className="h-24 w-full" />
      <Rows count={6} height="h-12" />
    </Page>
  );
}

export function SyncSkeleton() {
  return (
    <Page wide={false} gap="gap-6">
      <Heading intro />
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Bar key={i} className="h-32" />
        ))}
      </div>
      <div className="flex flex-col gap-3">
        <Bar className="h-5 w-32" />
        <Rows count={3} height="h-6" />
      </div>
      <Rows count={6} height="h-10" />
    </Page>
  );
}

/** A part's or a car's page: photos on one side, details on the other. */
export function DetailSkeleton() {
  return (
    <main aria-busy="true" className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-4 md:p-6">
      <Bar className="h-5 w-24" />
      <div className="flex flex-col gap-2">
        <Bar className="h-7 w-full max-w-lg" />
        <Bar className="h-4 w-64" />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Bar className="aspect-4/3 w-full" />
        <Rows count={10} height="h-6" />
      </div>
    </main>
  );
}

/** The skeleton for a page by its address, for the sidebar to show the moment a link is clicked. */
export function PageSkeleton({ href }: { href: string }) {
  const path = href.split("?")[0];
  if (/^\/(parts|cars)\/[^/]+/.test(path)) return <DetailSkeleton />;
  if (path.startsWith("/cars")) return <CarsSkeleton />;
  if (path.startsWith("/reservations")) return <ReservationsSkeleton />;
  if (path.startsWith("/users")) return <UsersSkeleton />;
  if (path.startsWith("/sync")) return <SyncSkeleton />;
  return <PartsSkeleton />;
}

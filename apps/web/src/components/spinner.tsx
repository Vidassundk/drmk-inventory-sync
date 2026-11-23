export function Spinner({ className }: { className: string }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-zinc-300 border-t-accent dark:border-zinc-700 dark:border-t-accent ${className}`}
    />
  );
}

/**
 * A spinner over the page while the next one loads. On wide screens it's centred in the content area, beside the
 * sidebar and below the header (w-60 and h-16 in the app layout), rather than in the whole window.
 */
export function PageLoader({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className="pointer-events-none fixed inset-0 z-20 grid place-items-center md:top-16 md:left-60"
    >
      {/* A disc behind it, so it stands out over busy tables and photos. */}
      <span className="grid rounded-full bg-background p-3 shadow-md ring-1 ring-zinc-200 dark:ring-zinc-800">
        <Spinner className="size-8" />
      </span>
    </div>
  );
}

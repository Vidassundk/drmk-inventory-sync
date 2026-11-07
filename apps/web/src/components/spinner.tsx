export function Spinner({ className }: { className: string }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-zinc-300 border-t-accent dark:border-zinc-700 dark:border-t-accent ${className}`}
    />
  );
}

"use client";

export default function PartsError({ reset }: { reset: () => void }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-6">
      <p>Nepavyko įkelti dalių.</p>
      <button onClick={reset} className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700">
        Bandyti dar kartą
      </button>
    </main>
  );
}

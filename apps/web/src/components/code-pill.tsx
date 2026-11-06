"use client";

import { useEffect, useRef, useState } from "react";

const COPIED_MS = 1500;

export function CodePill({ code, primary = false }: { code: string; primary?: boolean }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPIED_MS);
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 py-0.5 pr-1 pl-2.5 font-mono text-xs dark:bg-zinc-900">
      <span className={primary ? "font-semibold" : undefined}>{code}</span>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? `Kodas ${code} nukopijuotas` : `Kopijuoti kodą ${code}`}
        title={copied ? "Nukopijuota" : "Kopijuoti"}
        className="rounded-full p-1 text-zinc-500 hover:bg-zinc-200 hover:text-foreground dark:hover:bg-zinc-800"
      >
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
          className="size-3 fill-none stroke-current stroke-[1.5]"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {copied ? (
            <path d="M3 8.5 6.5 12 13 4.5" />
          ) : (
            <>
              <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
              <path d="M10.5 3.5v-.5A1.5 1.5 0 0 0 9 1.5H3A1.5 1.5 0 0 0 1.5 3v6A1.5 1.5 0 0 0 3 10.5h.5" />
            </>
          )}
        </svg>
      </button>
    </span>
  );
}

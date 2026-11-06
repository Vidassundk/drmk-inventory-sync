"use client";

import { THEME_COOKIE, type Theme } from "@/lib/theme";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function toggleTheme() {
  const root = document.documentElement;
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const current = root.dataset.theme ?? (systemDark ? "dark" : "light");
  const next: Theme = current === "dark" ? "light" : "dark";
  root.dataset.theme = next;
  document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
}

/** Both icons are rendered and CSS shows the right one, because the server can't know the system setting. */
export function ThemeToggle() {
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Perjungti šviesią ar tamsią temą"
      title="Perjungti temą"
      className="grid size-8 place-items-center rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900"
    >
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className="hidden size-4 fill-none stroke-current stroke-[1.5] dark:block"
        strokeLinecap="round"
      >
        <circle cx="8" cy="8" r="3" />
        <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1" />
      </svg>
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className="block size-4 fill-none stroke-current stroke-[1.5] dark:hidden"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M13.5 9.6A5.8 5.8 0 0 1 6.4 2.5a5.8 5.8 0 1 0 7.1 7.1Z" />
      </svg>
    </button>
  );
}

"use client";

// Building blocks shared by the parts and cars filter bars.
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type RefObject,
  type UIEvent,
} from "react";
import { useI18n } from "@/components/i18n-provider";
import { Spinner } from "@/components/spinner";
import { OPTIONS_PAGE_SIZE } from "@/lib/parts-query";

export const SEARCH_DELAY_MS = 200;
const LOAD_MORE_DISTANCE_PX = 200;

// Panels sit under their chip, but under the whole row on phones, where a chip near the edge would push them off-screen.
export const PANEL =
  "absolute top-full left-0 z-20 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-zinc-200 bg-background shadow-lg dark:border-zinc-800";

export function PanelFooter({ onClear }: { onClear: () => void }) {
  const { t } = useI18n();

  return (
    <div className="flex items-center justify-between border-t border-zinc-200 px-3 py-2 dark:border-zinc-800">
      <button type="button" onClick={onClear} className="text-sm text-accent-text hover:underline">
        {t("parts.clearFilter")}
      </button>
      <button
        type="submit"
        className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
      >
        {t("filters.apply")}
      </button>
    </div>
  );
}

type CheckPanelProps<T> = {
  options: readonly T[];
  initial: T[];
  labelOf: (option: T) => string;
  onApply: (selected: T[]) => void;
  onClear: () => void;
};

/** A filter where several options can be ticked at once, like status and quality. */
export function CheckPanel<T extends string | number>({
  options,
  initial,
  labelOf,
  onApply,
  onClear,
}: CheckPanelProps<T>) {
  const [selected, setSelected] = useState(initial);

  function toggle(option: T) {
    setSelected((current) =>
      current.includes(option) ? current.filter((other) => other !== option) : [...current, option],
    );
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    onApply(options.filter((option) => selected.includes(option)));
  }

  return (
    <form onSubmit={submit} className={PANEL}>
      <div className="flex flex-col gap-1 p-3">
        {options.map((option) => (
          <label key={option} className="flex items-center gap-2 py-1 text-sm">
            <input type="checkbox" checked={selected.includes(option)} onChange={() => toggle(option)} />
            {labelOf(option)}
          </label>
        ))}
      </div>
      <PanelFooter onClear={onClear} />
    </form>
  );
}

type ListPanelProps = {
  options: string[];
  initial: string | null;
  label: string;
  onApply: (value: string | null) => void;
  onClear: () => void;
};

/** A searchable single-choice list short enough to send with the page, like car brands. */
export function ListPanel({ options, initial, label, onApply, onClear }: ListPanelProps) {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(initial);
  const term = search.trim().toLowerCase();
  const shown = options.filter((option) => option.toLowerCase().includes(term));

  function submit(event: FormEvent) {
    event.preventDefault();
    // Typing then pressing Enter means the top match, unless an option that's still listed was clicked.
    const clicked = selected && shown.includes(selected) ? selected : null;
    onApply(clicked ?? (term ? (shown[0] ?? null) : selected));
  }

  return (
    <form onSubmit={submit} className={PANEL}>
      <div className="p-2">
        <input
          type="search"
          autoFocus
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("filters.chooseOption")}
          aria-label={label}
          className="h-9 w-full rounded-md border border-zinc-300 bg-transparent px-3 text-sm outline-none focus:border-accent dark:border-zinc-700"
        />
      </div>
      <ul className="max-h-80 overflow-y-auto">
        {shown.map((option) => (
          <li key={option}>
            <button
              type="button"
              onClick={() => setSelected(option)}
              aria-pressed={option === selected}
              className="w-full px-3 py-1.5 text-left text-sm hover:bg-zinc-100 aria-pressed:bg-zinc-100 aria-pressed:font-medium aria-pressed:text-accent-text dark:hover:bg-zinc-900 dark:aria-pressed:bg-zinc-900"
            >
              {option}
            </button>
          </li>
        ))}
        {shown.length === 0 && <li className="px-3 py-2 text-sm text-zinc-500">{t("filters.noOptions")}</li>}
      </ul>
      <PanelFooter onClear={onClear} />
    </form>
  );
}

type RemoteOption = { id: number; label: string };

type RemotePanelProps = {
  /** The endpoint to load options from, which takes `q` and `offset` on top of these params. */
  url: string;
  params: Record<string, string>;
  label: string;
  initial: number | null;
  onApply: (id: number | null) => void;
  onClear: () => void;
};

/** A searchable list too long to send with the page, so it loads a page at a time as it scrolls. */
export function RemoteOptionsPanel({ url, params, label, initial, onApply, onClear }: RemotePanelProps) {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<RemoteOption[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [selected, setSelected] = useState(initial);
  const request = useRef<AbortController>(undefined);
  const paramsKey = new URLSearchParams(params).toString();
  // Which search the list shows, so anything else means a new one is on its way.
  const searchKey = `${paramsKey}|${search.trim()}`;
  const searching = loadedFor !== searchKey;

  const load = useCallback(
    async (offset: number) => {
      // A new search replaces whatever was still loading, so old results can't land on top of it.
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      const query = new URLSearchParams(paramsKey);
      query.set("q", search.trim());
      query.set("offset", String(offset));
      try {
        const response = await fetch(`${url}?${query}`, { signal: controller.signal });
        const page: RemoteOption[] = await response.json();
        setOptions((current) => (offset === 0 ? page : [...(current ?? []), ...page]));
        setHasMore(page.length === OPTIONS_PAGE_SIZE);
        setLoadingMore(false);
        setLoadedFor(searchKey);
      } catch (error) {
        if (!controller.signal.aborted) throw error;
      }
    },
    [url, paramsKey, search, searchKey],
  );

  useEffect(() => {
    const timer = setTimeout(() => load(0), SEARCH_DELAY_MS);
    return () => {
      clearTimeout(timer);
      request.current?.abort();
    };
  }, [load]);

  function loadMoreNearBottom(event: UIEvent<HTMLUListElement>) {
    const { scrollTop, clientHeight, scrollHeight } = event.currentTarget;
    if (!hasMore || loadingMore || searching || scrollHeight - scrollTop - clientHeight > LOAD_MORE_DISTANCE_PX) return;
    setLoadingMore(true);
    load(options?.length ?? 0);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    // Typing then pressing Enter means the top match, unless an option that's still listed was clicked.
    const listed = options?.some((option) => option.id === selected);
    onApply(listed || !search.trim() ? selected : (options?.[0]?.id ?? null));
  }

  return (
    <form onSubmit={submit} className={PANEL}>
      <div className="p-2">
        <input
          type="search"
          autoFocus
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("filters.chooseOption")}
          aria-label={label}
          className="h-9 w-full rounded-md border border-zinc-300 bg-transparent px-3 text-sm outline-none focus:border-accent dark:border-zinc-700"
        />
      </div>
      <ul onScroll={loadMoreNearBottom} className="max-h-80 min-h-10 overflow-y-auto">
        {!searching &&
          options?.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => setSelected(option.id)}
                aria-pressed={option.id === selected}
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-zinc-100 aria-pressed:bg-zinc-100 aria-pressed:font-medium aria-pressed:text-accent-text dark:hover:bg-zinc-900 dark:aria-pressed:bg-zinc-900"
              >
                {option.label}
              </button>
            </li>
          ))}
        {!searching && options?.length === 0 && (
          <li className="px-3 py-2 text-sm text-zinc-500">{t("filters.noOptions")}</li>
        )}
        {(searching || loadingMore) && (
          <li role="status" aria-label={t("filters.loading")} className="grid place-items-center py-3">
            <Spinner className="size-5" />
          </li>
        )}
      </ul>
      <PanelFooter onClear={onClear} />
    </form>
  );
}

export type MenuItem<K extends string> = { key: K; label: string };

/** The "+ add filter" menu: a searchable list of the filters a page offers. */
export function AddFilterMenu<K extends string>({
  items,
  onChoose,
}: {
  items: MenuItem<K>[];
  onChoose: (key: K) => void;
}) {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const term = search.trim().toLowerCase();
  const shown = items.filter((item) => item.label.toLowerCase().includes(term));

  return (
    <div className={PANEL}>
      <div className="p-2">
        <input
          type="search"
          autoFocus
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("filters.search")}
          aria-label={t("filters.searchLabel")}
          className="h-9 w-full rounded-md border border-zinc-300 bg-transparent px-3 text-sm outline-none focus:border-accent dark:border-zinc-700"
        />
      </div>
      <ul className="pb-1">
        {shown.map((item) => (
          <li key={item.key}>
            <button
              type="button"
              onClick={() => onChoose(item.key)}
              className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900"
            >
              {item.label}
              <span aria-hidden="true" className="text-zinc-400">
                ›
              </span>
            </button>
          </li>
        ))}
        {shown.length === 0 && <li className="px-3 py-2 text-sm text-zinc-500">{t("filters.noMatches")}</li>}
      </ul>
    </div>
  );
}

type ChipProps = {
  label: string;
  value?: string;
  open: boolean;
  onToggle: () => void;
  onRemove: () => void;
  children: ReactNode;
};

export function FilterChip({ label, value, open, onToggle, onRemove, children }: ChipProps) {
  const { t } = useI18n();

  return (
    <div className="md:relative">
      <div className="flex items-center rounded-full bg-zinc-100 text-sm dark:bg-zinc-900">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex items-center gap-1.5 py-1 pr-1 pl-3"
        >
          <span className="font-medium">
            {label}
            {value && ":"}
          </span>
          {value && <span className="max-w-64 truncate">{value}</span>}
          <span aria-hidden="true" className={`text-xs text-zinc-500 ${open ? "rotate-180" : ""}`}>
            ▾
          </span>
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label={t("filters.remove", { filter: label })}
          className="rounded-full px-2 py-1 text-zinc-500 hover:text-foreground"
        >
          ✕
        </button>
      </div>
      {open && children}
    </div>
  );
}

/** Closes an open panel on Escape or on a click outside `root`. */
export function useDismiss(open: boolean, close: () => void, root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) close();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, close, root]);
}

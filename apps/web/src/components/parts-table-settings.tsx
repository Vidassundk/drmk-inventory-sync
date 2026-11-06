"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useI18n } from "@/components/i18n-provider";
import {
  COLUMNS_COOKIE,
  DEFAULT_COLUMN_SETTINGS,
  isLocked,
  type ColumnSettings,
  type PartColumnKey,
} from "@/lib/part-columns";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function writeCookie(settings: ColumnSettings) {
  const value = encodeURIComponent(JSON.stringify(settings));
  document.cookie = `${COLUMNS_COOKIE}=${value}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
}

type RowProps = { columnKey: PartColumnKey; checked: boolean; sortable: boolean; onToggle: () => void };

function ColumnRow({ columnKey, checked, sortable, onToggle }: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: columnKey,
    disabled: !sortable,
  });
  const { t } = useI18n();
  const label = t(`columns.${columnKey}`);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded bg-background py-1.5 text-sm ${isDragging ? "relative z-10 shadow-md" : ""}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={t("settings.move", { column: label })}
        className="cursor-grab touch-none px-1 text-zinc-400 hover:text-foreground disabled:invisible"
        disabled={!sortable}
      >
        ⠿
      </button>
      <label className="flex flex-1 items-center gap-2">
        <input type="checkbox" checked={checked} disabled={isLocked(columnKey)} onChange={onToggle} />
        {label}
      </label>
    </li>
  );
}

export function PartsTableSettings({ settings: initial }: { settings: ColumnSettings }) {
  const router = useRouter();
  const { t } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  const [settings, setSettings] = useState(initial);
  const [search, setSearch] = useState("");
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function save(next: ColumnSettings) {
    setSettings(next);
    writeCookie(next);
    startTransition(() => router.refresh());
  }

  function toggle(key: PartColumnKey) {
    const hidden = settings.hidden.includes(key)
      ? settings.hidden.filter((other) => other !== key)
      : [...settings.hidden, key];
    save({ ...settings, hidden });
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = settings.order.indexOf(active.id as PartColumnKey);
    const to = settings.order.indexOf(over.id as PartColumnKey);
    save({ ...settings, order: arrayMove(settings.order, from, to) });
  }

  const showingAll = settings.hidden.length === 0;
  const hidingAll = settings.order.every((key) => isLocked(key) || settings.hidden.includes(key));
  const term = search.trim().toLowerCase();
  const shown = settings.order.filter((key) => t(`columns.${key}`).toLowerCase().includes(term));

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        aria-label={t("settings.title")}
        title={t("settings.title")}
        className="grid size-9 shrink-0 place-items-center rounded-md border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
          className="size-4 fill-none stroke-current stroke-[1.5]"
          strokeLinecap="round"
        >
          <path d="M2 4h6.5M12 4h2M2 8h2M7.5 8H14M2 12h6.5M12 12h2" />
          <circle cx="10.25" cy="4" r="1.75" />
          <circle cx="5.75" cy="8" r="1.75" />
          <circle cx="10.25" cy="12" r="1.75" />
        </svg>
      </button>
      <dialog
        ref={dialog}
        aria-label={t("settings.title")}
        onClick={(event) => event.target === dialog.current && dialog.current.close()}
        className="m-0 ml-auto h-dvh max-h-none w-80 max-w-full bg-background text-foreground backdrop:bg-black/40"
      >
        <div className="flex h-full flex-col gap-3 p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{t("settings.title")}</h2>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              aria-label={t("settings.close")}
              className="px-1 text-lg"
            >
              ✕
            </button>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              ref={(checkbox) => {
                if (checkbox) checkbox.indeterminate = !showingAll && !hidingAll;
              }}
              type="checkbox"
              checked={showingAll}
              onChange={() =>
                save({
                  ...settings,
                  hidden: showingAll ? settings.order.filter((key) => !isLocked(key)) : [],
                })
              }
            />
            {t("settings.showAll")}
          </label>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("settings.search")}
            aria-label={t("settings.searchLabel")}
            className="h-9 rounded-md border border-zinc-300 bg-transparent px-3 text-sm outline-none focus:border-blue-600 dark:border-zinc-700"
          />
          <DndContext id="parts-columns" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={shown} strategy={verticalListSortingStrategy}>
              <ul className="flex-1 overflow-y-auto">
                {shown.map((key) => (
                  <ColumnRow
                    key={key}
                    columnKey={key}
                    checked={!settings.hidden.includes(key)}
                    sortable={!term}
                    onToggle={() => toggle(key)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
          <button
            type="button"
            onClick={() => save(DEFAULT_COLUMN_SETTINGS)}
            className="self-start text-sm text-zinc-500 hover:text-foreground"
          >
            {t("settings.reset")}
          </button>
        </div>
      </dialog>
    </>
  );
}

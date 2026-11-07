"use client";

import { useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { PhotoIcon } from "@/components/icons";

/** `thumbs` are smaller copies for the strip below, matched by position; without them the full photos are used. */
export function PartGallery({ urls, thumbs = [], alt }: { urls: string[]; thumbs?: (string | null)[]; alt: string }) {
  const { t } = useI18n();
  const [selected, setSelected] = useState(0);
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());

  const markFailed = (url: string) => setFailed((previous) => new Set(previous).add(url));
  const main = urls[selected];

  return (
    <div className="flex flex-col gap-2">
      <div className="relative grid aspect-4/3 w-full place-items-center overflow-hidden rounded-lg bg-zinc-100 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-600">
        <PhotoIcon className="size-16" />
        {main && !failed.has(main) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={main}
            alt={alt}
            onError={() => markFailed(main)}
            className="absolute inset-0 h-full w-full object-contain"
          />
        )}
      </div>
      {urls.length > 1 && (
        <ul className="flex flex-wrap gap-2">
          {urls.map((url, index) => (
            <li key={url}>
              <button
                type="button"
                onClick={() => setSelected(index)}
                aria-label={t("gallery.photo", { number: index + 1 })}
                aria-current={index === selected}
                className="relative grid h-16 w-20 place-items-center overflow-hidden rounded bg-zinc-100 text-zinc-400 ring-accent aria-[current=true]:ring-2 dark:bg-zinc-900 dark:text-zinc-600"
              >
                <PhotoIcon className="size-6" />
                {!failed.has(url) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumbs[index] ?? url}
                    alt=""
                    loading="lazy"
                    onError={() => markFailed(url)}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

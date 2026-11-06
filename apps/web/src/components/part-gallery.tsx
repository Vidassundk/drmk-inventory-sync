"use client";

import { useState } from "react";
import { useI18n } from "@/components/i18n-provider";

export function PartGallery({ urls, alt }: { urls: string[]; alt: string }) {
  const { t } = useI18n();
  const [selected, setSelected] = useState(0);
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());

  const markFailed = (url: string) => setFailed((previous) => new Set(previous).add(url));
  const main = urls[selected];

  return (
    <div className="flex flex-col gap-2">
      <div className="aspect-4/3 w-full overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-900">
        {main && !failed.has(main) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={main} alt={alt} onError={() => markFailed(main)} className="h-full w-full object-contain" />
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
                className="block h-16 w-20 overflow-hidden rounded bg-zinc-100 ring-blue-600 aria-[current=true]:ring-2 dark:bg-zinc-900"
              >
                {!failed.has(url) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={url}
                    alt=""
                    loading="lazy"
                    onError={() => markFailed(url)}
                    className="h-full w-full object-cover"
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

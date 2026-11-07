"use client";

import { useState } from "react";
import { PhotoIcon } from "@/components/icons";

/**
 * A plain img: photos load straight from R2 or Ovoko. Ovoko can refuse when its hourly limit is hit.
 * The placeholder sits underneath, so it shows while loading, and stays when there is no photo or it fails.
 */
export function PartCover({ src, alt, photoCount }: { src: string | null; alt: string; photoCount: number }) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="relative grid h-14 w-20 place-items-center overflow-hidden rounded bg-zinc-100 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-600">
      <PhotoIcon className="size-6" />
      {src && !failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      {photoCount > 0 && (
        <span className="absolute right-0.5 bottom-0.5 rounded bg-black/60 px-1 text-[10px] leading-4 text-white">
          {photoCount}
        </span>
      )}
    </div>
  );
}

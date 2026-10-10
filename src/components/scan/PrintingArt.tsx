"use client";

import { useState } from "react";
import type { CardPrinting } from "@/types/catalog";
import { cn } from "@/lib/utils";

interface PrintingArtProps {
  printing: CardPrinting | null;
  className?: string;
}

/**
 * Catalog artwork for a printing (TCGdex `low.webp`), or a metadata
 * placeholder when there is no printing, no image, or the image fails to load
 * (e.g. offline). Never shows a photo.
 */
export function PrintingArt({ printing, className }: PrintingArtProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = printing?.imageUrl ?? null;
  const frame = cn("aspect-[63/88] shrink-0 overflow-hidden rounded-md", className);

  if (printing && url && failedUrl !== url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`${url}/low.webp`}
        alt={`${printing.name} card`}
        loading="lazy"
        onError={() => setFailedUrl(url)}
        className={cn(frame, "bg-surface-raised object-cover")}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={printing ? `${printing.name} (no picture)` : "Unknown card"}
      className={cn(
        frame,
        "flex flex-col items-center justify-center gap-1 border border-border bg-surface-raised p-1 text-center",
      )}
    >
      <span className="font-display text-[0.7rem] leading-tight text-ink">
        {printing?.name ?? "?"}
      </span>
      {printing && (
        <span className="font-mono text-[0.55rem] text-ink-muted">
          {printing.collectorNumber}/{printing.set.officialCount}
        </span>
      )}
    </div>
  );
}

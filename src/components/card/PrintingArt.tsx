"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";
import type { CardPrinting } from "@/types/catalog";
import { catalogImageSrc, type CatalogImageQuality } from "@/lib/catalog/tcgdex";
import { formatCollectorNumber } from "@/lib/collection-utils";
import { cn } from "@/lib/utils";

interface PrintingArtProps {
  printing: CardPrinting;
  /** `low` for tiles, `high` for the hero and detail sheet. */
  quality: CatalogImageQuality;
  /** Smaller type and radius for grid tiles. */
  compact?: boolean;
  className?: string;
}

/**
 * A printing's catalog artwork at real card proportions (5:7). Shows a
 * skeleton while the image loads and falls back to the labelled metadata
 * placeholder when the printing has no image or the image fails to load
 * (offline and uncached, or a broken URL). Never generated art.
 */
export function PrintingArt({ printing, quality, compact = false, className }: PrintingArtProps) {
  const src = catalogImageSrc(printing.imageUrl, quality);
  return (
    <span
      className={cn(
        "relative block aspect-[5/7] w-full overflow-hidden bg-surface-raised",
        compact ? "rounded-[10px]" : "rounded-[18px]",
        className,
      )}
    >
      {src ? (
        // Keyed by src so a new image starts from the loading state again.
        <CatalogImage key={src} src={src} printing={printing} compact={compact} />
      ) : (
        <PrintingPlaceholder printing={printing} compact={compact} reason="missing" />
      )}
    </span>
  );
}

type LoadStatus = "loading" | "loaded" | "error";

function CatalogImage({
  src,
  printing,
  compact,
}: {
  src: string;
  printing: CardPrinting;
  compact: boolean;
}) {
  const [status, setStatus] = useState<LoadStatus>("loading");

  if (status === "error") {
    return <PrintingPlaceholder printing={printing} compact={compact} reason="unavailable" />;
  }

  return (
    <>
      {status === "loading" && (
        <span
          aria-hidden
          data-testid="art-skeleton"
          className="absolute inset-0 block animate-pulse bg-surface motion-reduce:animate-none"
        />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element -- static export, catalog hot-link (D8) */}
      <img
        src={src}
        alt={printing.name}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("error")}
        className={cn(
          "absolute inset-0 size-full object-cover transition-opacity duration-200",
          status === "loaded" ? "opacity-100" : "opacity-0",
        )}
      />
    </>
  );
}

const PLACEHOLDER_LABEL = {
  missing: "No card picture",
  unavailable: "Picture unavailable",
} as const;

/**
 * The labelled metadata placeholder: the card's verified facts on a plain
 * panel, with an explicit label so it never passes for real artwork.
 */
function PrintingPlaceholder({
  printing,
  compact,
  reason,
}: {
  printing: CardPrinting;
  compact: boolean;
  reason: keyof typeof PLACEHOLDER_LABEL;
}) {
  const label = PLACEHOLDER_LABEL[reason];
  return (
    <span
      role="img"
      aria-label={`${label}: ${printing.name}, ${printing.set.name} ${formatCollectorNumber(printing)}`}
      className={cn(
        "absolute inset-0 flex flex-col items-center justify-center gap-1 border-2 border-dashed border-border bg-surface text-center",
        compact ? "rounded-[10px] p-2" : "rounded-[18px] p-4",
      )}
    >
      <ImageOff aria-hidden className={cn("text-ink-muted", compact ? "size-5" : "size-8")} />
      <span
        className={cn(
          "font-display leading-tight text-ink",
          compact ? "line-clamp-2 text-sm" : "text-xl",
        )}
      >
        {printing.name}
      </span>
      <span
        className={cn(
          "font-mono uppercase tracking-wider text-ink-muted",
          compact ? "text-[0.55rem]" : "text-[0.66rem]",
        )}
      >
        {printing.set.name} · {formatCollectorNumber(printing)}
      </span>
      {!compact && printing.rarity && (
        <span className="font-mono text-[0.66rem] uppercase tracking-wider text-ink-muted">
          {printing.rarity}
        </span>
      )}
      <span
        className={cn(
          "mt-1 rounded-full bg-background font-mono font-bold uppercase tracking-wider text-ink-muted",
          compact ? "px-1.5 py-0.5 text-[0.5rem]" : "px-2.5 py-1 text-[0.62rem]",
        )}
      >
        {label}
      </span>
    </span>
  );
}

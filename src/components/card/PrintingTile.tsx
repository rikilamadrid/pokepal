import { Star } from "lucide-react";
import type { PrintingGroup } from "@/lib/collection-utils";
import { formatCollectorNumber } from "@/lib/collection-utils";
import { PrintingArt } from "@/components/card/PrintingArt";
import { QuantityBadge } from "@/components/card/QuantityBadge";
import { cn } from "@/lib/utils";

interface PrintingTileProps {
  group: PrintingGroup;
  onSelect?: (group: PrintingGroup) => void;
  className?: string;
}

/**
 * Compact 2.0 card for grids and home rows: one tile per exact printing, with
 * its catalog artwork, a ×N badge when more than one copy is owned, and a star
 * when any copy is a favorite.
 */
export function PrintingTile({ group, onSelect, className }: PrintingTileProps) {
  const { printing, count, favorite } = group;
  const number = formatCollectorNumber(printing);
  const interactive = Boolean(onSelect);

  return (
    <button
      type="button"
      disabled={!interactive}
      onClick={interactive ? () => onSelect?.(group) : undefined}
      aria-label={`${printing.name}, ${printing.set.name} ${number}, ${count} ${count === 1 ? "copy" : "copies"}${favorite ? ", favorite" : ""}`}
      className={cn(
        "press block w-full rounded-[12px] text-left outline-none focus-visible:ring-2 focus-visible:ring-red disabled:pointer-events-none",
        className,
      )}
    >
      <span className="relative block shadow">
        <PrintingArt printing={printing} quality="low" compact />
        {count > 1 && <QuantityBadge count={count} className="absolute left-1.5 top-1.5" />}
        {favorite && (
          <Star
            aria-hidden
            className="absolute right-1.5 top-1.5 size-4 fill-gold text-gold drop-shadow"
          />
        )}
      </span>
      <span className="mt-1.5 block truncate font-display text-sm leading-tight text-ink">
        {printing.name}
      </span>
      <span className="block truncate font-mono text-[0.58rem] uppercase tracking-wider text-ink-muted">
        {printing.set.name} · {number}
      </span>
    </button>
  );
}

import { Star } from "lucide-react";
import type { Card } from "@/types/card";
import { typeGradientCss } from "@/lib/type-gradients";
import { cn } from "@/lib/utils";

interface CardTileProps {
  card: Card;
  /** Duplicate count for the ×N badge; omit or ≤1 to hide. */
  duplicateCount?: number;
  onSelect?: (card: Card) => void;
  className?: string;
}

/**
 * Compact card for the 2-column collection grid and scrollable home rows. Shares
 * the gold frame + type-gradient art with {@link PokeCard} at thumbnail scale:
 * art fills the tile, name + `#dex · type` sit on a dark plate at the bottom.
 */
export function CardTile({
  card,
  duplicateCount,
  onSelect,
  className,
}: CardTileProps) {
  const isHolo = card.rarity === "holo";
  const isDuplicate = (duplicateCount ?? 0) > 1;
  const interactive = Boolean(onSelect);

  return (
    <button
      type="button"
      disabled={!interactive}
      onClick={interactive ? () => onSelect?.(card) : undefined}
      aria-label={`${card.name}, ${card.type}, ${card.rarity}`}
      className={cn(
        "press relative block aspect-[3/4] w-full overflow-hidden rounded-2xl p-[3px] text-left shadow",
        "disabled:pointer-events-none",
        className,
      )}
      style={{ backgroundImage: "linear-gradient(150deg, #ffd97a, #eaa53a)" }}
    >
      <span
        className="relative block size-full overflow-hidden rounded-[14px]"
        style={{ backgroundImage: typeGradientCss(card.type) }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={card.img}
          alt={card.name}
          className="absolute inset-0 size-full object-cover"
        />
        {isHolo && <span className="holo-sweep absolute inset-0 block" />}

        {card.favorite && (
          <Star
            aria-hidden
            className="absolute right-1.5 top-1.5 size-4 fill-gold text-gold drop-shadow"
          />
        )}
        {isDuplicate && (
          <span className="absolute bottom-9 left-1.5 rounded border border-black/20 bg-gold px-1 py-px font-mono text-[0.58rem] font-bold text-black">
            ×{duplicateCount}
          </span>
        )}

        {/* Name plate */}
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-2 pb-1.5 pt-5">
          <span className="block truncate font-display text-sm leading-tight text-white">
            {card.name}
          </span>
          <span className="block truncate font-mono text-[0.58rem] uppercase tracking-wider text-white/70">
            #{card.dexNo} · {card.type}
          </span>
        </span>
      </span>
    </button>
  );
}

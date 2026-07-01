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
 * Compact card for the 2-column collection grid and scrollable home rows. A
 * scaled-down {@link PokeCard}: gold frame → dark body → bordered type-gradient
 * art panel + a dark name plate, so tiles read as miniatures of the hero.
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
        "press relative block aspect-[3/4] w-full rounded-[18px] p-[4px] text-left shadow",
        "disabled:pointer-events-none",
        className,
      )}
      style={{ backgroundImage: "linear-gradient(150deg, #ffd97a, #eaa53a)" }}
    >
      <span className="flex h-full flex-col gap-1.5 rounded-[14px] bg-[#14110b] p-1.5">
        {/* Art panel */}
        <span
          className="relative block flex-1 overflow-hidden rounded-[10px] border border-[#f2c14e]"
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
        </span>

        {/* Name plate */}
        <span className="relative block rounded-[10px] bg-[#0f1015] px-2 py-1.5">
          {isDuplicate && (
            <span className="absolute -top-2.5 left-1.5 rounded border border-black/20 bg-gold px-1 py-px font-mono text-[0.58rem] font-bold text-black">
              ×{duplicateCount}
            </span>
          )}
          <span className="block truncate font-display text-sm leading-tight text-gold">
            {card.name}
          </span>
          <span className="block truncate font-mono text-[0.58rem] uppercase tracking-wider text-ink-muted">
            #{card.dexNo} · {card.type}
          </span>
        </span>
      </span>
    </button>
  );
}

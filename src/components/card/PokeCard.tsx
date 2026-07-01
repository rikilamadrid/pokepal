import type { Card } from "@/types/card";
import { typeGradientCss } from "@/lib/type-gradients";
import { formatCaughtDate } from "@/lib/date";
import { TypeBadge } from "@/components/card/TypeBadge";
import { cn } from "@/lib/utils";

interface PokeCardProps {
  card: Card;
  /** Duplicate count for the ×N badge; omit or ≤1 to hide. */
  duplicateCount?: number;
  onSelect?: (card: Card) => void;
  className?: string;
}

/**
 * The full gold-framed card used for the home hero and detail sheet. Renders the
 * card's photo `img` if present, otherwise its generated SVG art. Data-driven
 * from a `Card`; screens wire `onSelect` to open the detail sheet later.
 */
export function PokeCard({
  card,
  duplicateCount,
  onSelect,
  className,
}: PokeCardProps) {
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
        "press relative block aspect-[3/4] w-full rounded-[26px] p-[6px] text-left shadow-lg",
        "disabled:pointer-events-none",
        className,
      )}
      style={{ backgroundImage: "linear-gradient(150deg, #ffd97a, #eaa53a)" }}
    >
      <span className="flex h-full flex-col gap-2 rounded-[20px] bg-[#14110b] p-2">
        {/* Art panel */}
        <span
          className="relative block flex-1 overflow-hidden rounded-2xl border-2 border-[#f2c14e]"
          style={{ backgroundImage: typeGradientCss(card.type) }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={card.img}
            alt={card.name}
            className="absolute inset-0 size-full object-cover"
          />
          {isHolo && <span className="holo-sweep absolute inset-0 block" />}

          {/* Dex chip */}
          <span className="absolute left-2 top-2 rounded-md bg-black/70 px-1.5 py-0.5 font-mono text-[0.62rem] font-bold text-gold">
            #{card.dexNo}
          </span>
          {/* Type badge + favorite star */}
          <TypeBadge
            type={card.type}
            favorite={card.favorite}
            className="absolute right-2 top-2"
          />
        </span>

        {/* Name plate */}
        <span className="relative block rounded-2xl bg-[#0f1015] px-3 py-2">
          {isDuplicate && (
            <span className="absolute -top-3 left-2 rounded-md border border-black/20 bg-gold px-1.5 py-0.5 font-mono text-[0.62rem] font-bold text-black">
              ×{duplicateCount}
            </span>
          )}
          <span className="block truncate font-display text-lg leading-tight text-gold">
            {card.name}
          </span>
          <span className="mt-0.5 flex items-center justify-between font-mono text-[0.62rem] uppercase tracking-wider text-ink-muted">
            <span>{card.rarity}</span>
            <span>{formatCaughtDate(card.caughtAt)}</span>
          </span>
        </span>
      </span>
    </button>
  );
}

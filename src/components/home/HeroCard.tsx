import type { Card } from "@/types/card";
import { PokeCard } from "@/components/card/PokeCard";
import { formatCaughtDate } from "@/lib/date";

interface HeroCardProps {
  card: Card;
  /** Duplicate count for the hero's ×N badge. */
  duplicateCount?: number;
  onSelect?: (card: Card) => void;
}

/**
 * Home's "latest catch" hero: a large {@link PokeCard} with a gentle float/tilt
 * (holo sweep comes from PokeCard), followed by the name and a meta line.
 */
export function HeroCard({ card, duplicateCount, onSelect }: HeroCardProps) {
  return (
    <section className="flex flex-col items-center gap-3 px-5 pt-2">
      <p className="eyebrow self-start">Latest Catch</p>
      <div className="hero-float w-56 max-w-full">
        <PokeCard card={card} duplicateCount={duplicateCount} onSelect={onSelect} />
      </div>
      <div className="flex flex-col items-center gap-0.5 pt-1 text-center">
        <h2 className="font-display text-2xl leading-tight text-ink">{card.name}</h2>
        <p className="font-mono text-xs capitalize text-ink-muted">
          #{card.dexNo} · {card.type} · {card.rarity}
        </p>
        <p className="eyebrow">Caught {formatCaughtDate(card.caughtAt)}</p>
      </div>
    </section>
  );
}

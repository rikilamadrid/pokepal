import type { Card } from "@/types/card";
import { CardTile } from "@/components/card/CardTile";
import { CountPill } from "@/components/collection/CountPill";

/** Label and note for the legacy (1.x) group, shared by every screen. */
export const OLD_CARDS_LABEL = "Old cards";
export const OLD_CARDS_NOTE = "Cards saved before catalog matching.";

interface OldCardsSectionProps {
  cards: readonly Card[];
  dupCount: (dexNo: string) => number | undefined;
  onSelectCard?: (card: Card) => void;
}

/**
 * Legacy cards in their own labelled 2-column grid, below the 2.0 cards. Hidden
 * when there are none.
 */
export function OldCardsSection({ cards, dupCount, onSelectCard }: OldCardsSectionProps) {
  if (cards.length === 0) return null;
  return (
    <section aria-label={OLD_CARDS_LABEL} className="flex flex-col gap-3 pt-4">
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="eyebrow">{OLD_CARDS_LABEL}</span>
          <CountPill count={cards.length} />
        </div>
        <p className="text-xs text-ink-muted">{OLD_CARDS_NOTE}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {cards.map((card) => (
          <CardTile
            key={card.id}
            card={card}
            duplicateCount={dupCount(card.dexNo)}
            onSelect={onSelectCard}
          />
        ))}
      </div>
    </section>
  );
}

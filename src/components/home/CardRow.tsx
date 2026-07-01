import type { Card } from "@/types/card";
import { CardTile } from "@/components/card/CardTile";

interface CardRowProps {
  label: string;
  cards: Card[];
  /** Duplicate count per dex number for the ×N badge. */
  dupCount?: (dexNo: string) => number | undefined;
  onSelectCard?: (card: Card) => void;
  /** Optional "See all" affordance (e.g. Favorites → its tab). */
  onSeeAll?: () => void;
  /** Shown in place of the row when there are no cards. */
  emptyHint: string;
}

/**
 * Home's horizontal-scroll card strip: eyebrow label + count pill, an optional
 * "See all" link, and a momentum row of {@link CardTile}s (hidden scrollbar,
 * edge padding). Falls back to a friendly hint when empty.
 */
export function CardRow({
  label,
  cards,
  dupCount,
  onSelectCard,
  onSeeAll,
  emptyHint,
}: CardRowProps) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-5">
        <div className="flex items-center gap-2">
          <span className="eyebrow">{label}</span>
          <span className="grid min-w-5 place-items-center rounded-full bg-surface-raised px-1.5 font-mono text-[0.62rem] text-ink-muted">
            {cards.length}
          </span>
        </div>
        {onSeeAll && cards.length > 0 && (
          <button
            type="button"
            onClick={onSeeAll}
            className="press rounded-full px-1 font-mono text-[0.66rem] uppercase tracking-wider text-red outline-none focus-visible:ring-2 focus-visible:ring-red"
          >
            See all
          </button>
        )}
      </div>

      {cards.length === 0 ? (
        <p className="px-5 text-sm text-ink-muted">{emptyHint}</p>
      ) : (
        <div className="hide-scrollbar flex gap-3 overflow-x-auto px-5 pb-1">
          {cards.map((c) => (
            <div key={c.id} className="w-28 shrink-0">
              <CardTile
                card={c}
                duplicateCount={dupCount?.(c.dexNo)}
                onSelect={onSelectCard}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

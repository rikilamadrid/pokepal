"use client";

import { useCallback, useMemo, useRef } from "react";
import { Star } from "lucide-react";
import { useCollection } from "@/hooks/useCollection";
import { findDuplicates } from "@/lib/collection-utils";
import { formatCaughtDate } from "@/lib/date";
import { PokeCard } from "@/components/card/PokeCard";
import { DetailSheet } from "@/components/card/DetailSheet";
import { cn } from "@/lib/utils";

interface CardDetailSheetProps {
  /** Id of the legacy card to show; `null` keeps the sheet closed. */
  cardId: string | null;
  onClose: () => void;
}

/**
 * Bottom-sheet detail for a legacy (1.x) card. Shows the full PokeCard, a 2×2
 * stat grid, and the favorite / release actions. Reads the card live from the
 * store so favorite toggles reflect instantly.
 */
export function CardDetailSheet({ cardId, onClose }: CardDetailSheetProps) {
  const { cards, toggleFavorite, releaseCard } = useCollection();
  // Deferred until the slide-down finishes so the card stays visible mid-exit.
  const pendingRelease = useRef<string | null>(null);

  const card = useMemo(
    () => cards.find((c) => c.id === cardId) ?? null,
    [cards, cardId],
  );
  const dupCount = useMemo(
    () => (card ? findDuplicates(cards).get(card.dexNo) : undefined),
    [cards, card],
  );

  const onClosed = useCallback(() => {
    if (pendingRelease.current) releaseCard(pendingRelease.current);
    onClose();
  }, [onClose, releaseCard]);

  if (!card) return null;

  return (
    <DetailSheet title={card.name} onClosed={onClosed}>
      {(requestClose) => (
        <>
          {/* Full card */}
          <div className="mx-auto w-[62%] min-w-[180px]">
            <PokeCard card={card} duplicateCount={dupCount} />
          </div>

          {/* 2×2 stat grid */}
          <dl className="mt-5 grid grid-cols-2 gap-2.5">
            <Stat label="Dex No." value={`#${card.dexNo}`} />
            <Stat label="Type" value={card.type} />
            <Stat label="Rarity" value={card.rarity} />
            <Stat label="Caught" value={formatCaughtDate(card.caughtAt)} />
          </dl>

          {/* Actions */}
          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={() => toggleFavorite(card.id)}
              aria-pressed={card.favorite}
              className={cn(
                "press flex flex-1 items-center justify-center gap-2 rounded-full py-3 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-gold",
                card.favorite
                  ? "bg-gold text-black"
                  : "bg-surface-raised text-ink",
              )}
            >
              <Star className={cn("size-4", card.favorite && "fill-black")} />
              {card.favorite ? "Favorited" : "Favorite"}
            </button>
            <button
              type="button"
              onClick={() => {
                pendingRelease.current = card.id;
                requestClose();
              }}
              className="press flex-1 rounded-full bg-red/15 py-3 font-semibold text-red outline-none focus-visible:ring-2 focus-visible:ring-red"
            >
              Release
            </button>
          </div>
        </>
      )}
    </DetailSheet>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface-raised px-3.5 py-2.5">
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-0.5 font-mono text-sm font-bold uppercase text-ink">
        {value}
      </dd>
    </div>
  );
}

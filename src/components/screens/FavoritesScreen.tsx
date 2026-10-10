"use client";

import { useMemo } from "react";
import type { Card } from "@/types/card";
import { useCollection } from "@/hooks/useCollection";
import { useOwnedCollection } from "@/hooks/useOwnedCollection";
import {
  favoritePrintingGroups,
  findDuplicates,
  groupByPrinting,
  legacyNewestFirst,
  type PrintingGroup,
} from "@/lib/collection-utils";
import { PrintingTile } from "@/components/card/PrintingTile";
import { CountPill } from "@/components/collection/CountPill";
import { OldCardsSection } from "@/components/collection/OldCardsSection";

interface FavoritesScreenProps {
  /** Open the detail sheet for a legacy card. */
  onSelectCard?: (card: Card) => void;
  /** Open the detail sheet for a 2.0 printing. */
  onSelectPrinting?: (group: PrintingGroup) => void;
}

/**
 * Favorites screen: every printing with a starred copy, newest first, then
 * starred legacy cards in a labelled "Old cards" grid. Updates live as cards
 * are favorited/unfavorited from the detail sheets.
 */
export function FavoritesScreen({ onSelectCard, onSelectPrinting }: FavoritesScreenProps) {
  const { cards, ready } = useCollection();
  const { owned, printings } = useOwnedCollection();

  const favorites = useMemo(
    () => favoritePrintingGroups(groupByPrinting(owned, printings)),
    [owned, printings],
  );

  const { oldFavorites, oldDupCount } = useMemo(() => {
    const dupMap = findDuplicates(cards);
    return {
      oldFavorites: legacyNewestFirst(cards.filter((c) => c.favorite)),
      oldDupCount: (dexNo: string) => dupMap.get(dexNo),
    };
  }, [cards]);

  if (!ready) return null;

  const empty = favorites.length === 0 && oldFavorites.length === 0;

  return (
    <div className="flex flex-col gap-4 px-5 pb-8 pt-5">
      <h1 className="font-display text-3xl tracking-wide text-ink">Favorites</h1>

      {empty ? (
        <p className="pt-6 text-center text-sm text-ink-muted">
          No favorites yet — tap the ☆ on any card to star it.
        </p>
      ) : (
        <>
          {favorites.length > 0 && (
            <section aria-label="Starred" className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="eyebrow">Starred</span>
                <CountPill count={favorites.length} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {favorites.map((group) => (
                  <PrintingTile
                    key={group.printing.id}
                    group={group}
                    onSelect={onSelectPrinting}
                  />
                ))}
              </div>
            </section>
          )}
          <OldCardsSection
            cards={oldFavorites}
            dupCount={oldDupCount}
            onSelectCard={onSelectCard}
          />
        </>
      )}
    </div>
  );
}

"use client";

import { useMemo } from "react";
import type { Card } from "@/types/card";
import { useCollection } from "@/hooks/useCollection";
import { useOwnedCollection } from "@/hooks/useOwnedCollection";
import {
  duplicatePrintingGroups,
  favoritePrintingGroups,
  findDuplicates,
  groupByPrinting,
  legacyNewestFirst,
  type PrintingGroup,
} from "@/lib/collection-utils";
import { HeroPrinting } from "@/components/home/HeroPrinting";
import { CardRow } from "@/components/home/CardRow";
import { CardTile } from "@/components/card/CardTile";
import { PrintingTile } from "@/components/card/PrintingTile";
import { OLD_CARDS_LABEL, OLD_CARDS_NOTE } from "@/components/collection/OldCardsSection";

const FAVORITES_CAP = 8;

interface HomeScreenProps {
  /** Open the detail sheet for a legacy card. */
  onSelectCard?: (card: Card) => void;
  /** Open the detail sheet for a 2.0 printing. */
  onSelectPrinting?: (group: PrintingGroup) => void;
  /** Switch to the Favorites tab ("See all"). */
  onSeeAllFavorites?: () => void;
}

const printingKey = (group: PrintingGroup) => group.printing.id;
const cardKey = (card: Card) => card.id;

/**
 * Home screen: latest-catch hero, favorites row (capped at 8), and duplicates
 * row from 2.0 printings, then legacy cards in a labelled "Old cards" row.
 */
export function HomeScreen({
  onSelectCard,
  onSelectPrinting,
  onSeeAllFavorites,
}: HomeScreenProps) {
  const { cards, ready } = useCollection();
  const { owned, printings } = useOwnedCollection();

  const { groups, favorites, duplicates } = useMemo(() => {
    const all = groupByPrinting(owned, printings);
    return {
      groups: all,
      favorites: favoritePrintingGroups(all).slice(0, FAVORITES_CAP),
      duplicates: duplicatePrintingGroups(all),
    };
  }, [owned, printings]);

  const { oldCards, oldDupCount } = useMemo(() => {
    const dupMap = findDuplicates(cards);
    return {
      oldCards: legacyNewestFirst(cards),
      oldDupCount: (dexNo: string) => dupMap.get(dexNo),
    };
  }, [cards]);

  if (!ready) return null;

  if (groups.length === 0 && oldCards.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
        <p className="font-display text-2xl text-ink">No cards yet</p>
        <p className="text-sm text-ink-muted">
          Tap the Pokéball to scan your first card.
        </p>
      </div>
    );
  }

  const renderPrinting = (group: PrintingGroup) => (
    <PrintingTile group={group} onSelect={onSelectPrinting} />
  );

  return (
    <div className="flex flex-col gap-8 pb-8 pt-3">
      {groups.length > 0 ? (
        <>
          <HeroPrinting group={groups[0]} onSelect={onSelectPrinting} />
          <CardRow
            label="Favorites"
            items={favorites}
            itemKey={printingKey}
            renderItem={renderPrinting}
            onSeeAll={onSeeAllFavorites}
            emptyHint="Star a card to see it here."
          />
          <CardRow
            label="Duplicates"
            items={duplicates}
            itemKey={printingKey}
            renderItem={renderPrinting}
            emptyHint="No duplicates yet — every card is one of a kind."
          />
        </>
      ) : (
        <div className="flex flex-col items-center gap-1 px-8 pt-6 text-center">
          <p className="font-display text-2xl text-ink">No catalog cards yet</p>
          <p className="text-sm text-ink-muted">
            Cards matched to the official catalog show here with their real artwork.
          </p>
        </div>
      )}
      {oldCards.length > 0 && (
        <CardRow
          label={OLD_CARDS_LABEL}
          description={OLD_CARDS_NOTE}
          items={oldCards}
          itemKey={cardKey}
          renderItem={(card) => (
            <CardTile
              card={card}
              duplicateCount={oldDupCount(card.dexNo)}
              onSelect={onSelectCard}
            />
          )}
          emptyHint=""
        />
      )}
    </div>
  );
}

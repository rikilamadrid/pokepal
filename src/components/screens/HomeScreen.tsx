"use client";

import { useMemo } from "react";
import type { Card } from "@/types/card";
import { useCollection } from "@/hooks/useCollection";
import { findDuplicates } from "@/lib/collection-utils";
import { HeroCard } from "@/components/home/HeroCard";
import { CardRow } from "@/components/home/CardRow";

const FAVORITES_CAP = 8;

interface HomeScreenProps {
  /** Open the detail sheet for a card (wired in phase 7). */
  onSelectCard?: (card: Card) => void;
  /** Switch to the Favorites tab ("See all"). */
  onSeeAllFavorites?: () => void;
}

/**
 * Home screen: latest-catch hero, favorites row (capped at 8), and duplicates
 * row — all derived live from the collection store via the phase-3 cards.
 */
export function HomeScreen({ onSelectCard, onSeeAllFavorites }: HomeScreenProps) {
  const { cards, ready } = useCollection();

  const { hero, favorites, duplicates, dupCount } = useMemo(() => {
    const dupMap = findDuplicates(cards);
    const newest = cards.reduce<Card | undefined>(
      (max, c) => (!max || c.caughtAt > max.caughtAt ? c : max),
      undefined,
    );
    return {
      hero: newest,
      favorites: cards.filter((c) => c.favorite).slice(0, FAVORITES_CAP),
      duplicates: cards.filter((c) => dupMap.has(c.dexNo)),
      dupCount: (dexNo: string) => dupMap.get(dexNo),
    };
  }, [cards]);

  if (!ready) return null;

  if (!hero) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
        <p className="font-display text-2xl text-ink">No cards yet</p>
        <p className="text-sm text-ink-muted">
          Tap the Pokéball to scan your first card.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 pb-8 pt-3">
      <HeroCard
        card={hero}
        duplicateCount={dupCount(hero.dexNo)}
        onSelect={onSelectCard}
      />
      <CardRow
        label="Favorites"
        cards={favorites}
        onSelectCard={onSelectCard}
        onSeeAll={onSeeAllFavorites}
        emptyHint="Star a card to see it here."
      />
      <CardRow
        label="Duplicates"
        cards={duplicates}
        dupCount={dupCount}
        onSelectCard={onSelectCard}
        emptyHint="No duplicates yet — every card is one of a kind."
      />
    </div>
  );
}

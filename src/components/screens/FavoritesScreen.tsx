"use client";

import { useMemo } from "react";
import type { Card } from "@/types/card";
import { useCollection } from "@/hooks/useCollection";
import { findDuplicates } from "@/lib/collection-utils";
import { CardTile } from "@/components/card/CardTile";

interface FavoritesScreenProps {
  /** Open the detail sheet for a card. */
  onSelectCard?: (card: Card) => void;
}

/**
 * Favorites screen: a 2-column grid of every starred card, newest first. Reuses
 * the Collection grid styling and updates live as cards are favorited/unfavorited
 * from the detail sheet.
 */
export function FavoritesScreen({ onSelectCard }: FavoritesScreenProps) {
  const { cards, ready } = useCollection();

  const { favorites, dupCount } = useMemo(() => {
    const dupMap = findDuplicates(cards);
    const favs = cards
      .filter((c) => c.favorite)
      .sort((a, b) =>
        a.caughtAt < b.caughtAt ? 1 : a.caughtAt > b.caughtAt ? -1 : 0,
      );
    return { favorites: favs, dupCount: (dexNo: string) => dupMap.get(dexNo) };
  }, [cards]);

  if (!ready) return null;

  return (
    <div className="flex flex-col gap-4 px-5 pb-8 pt-5">
      <h1 className="font-display text-3xl tracking-wide text-ink">Favorites</h1>

      <div className="flex items-center gap-2">
        <span className="eyebrow">Starred</span>
        <span className="grid min-w-5 place-items-center rounded-full bg-surface-raised px-1.5 font-mono text-[0.62rem] text-ink-muted">
          {favorites.length}
        </span>
      </div>

      {favorites.length === 0 ? (
        <p className="pt-6 text-center text-sm text-ink-muted">
          No favorites yet — tap the ☆ on any card to star it.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {favorites.map((c) => (
            <CardTile
              key={c.id}
              card={c}
              duplicateCount={dupCount(c.dexNo)}
              onSelect={onSelectCard}
            />
          ))}
        </div>
      )}
    </div>
  );
}

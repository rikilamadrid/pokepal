"use client";

import { useMemo, useState } from "react";
import type { Card } from "@/types/card";
import { useCollection } from "@/hooks/useCollection";
import { useDebounce } from "@/hooks/useDebounce";
import { findDuplicates } from "@/lib/collection-utils";
import { CardTile } from "@/components/card/CardTile";
import { SearchBar } from "@/components/collection/SearchBar";

interface CollectionScreenProps {
  /** Open the detail sheet for a card (wired in phase 7). */
  onSelectCard?: (card: Card) => void;
}

/**
 * Collection screen: a searchable 2-column grid of every card, newest first.
 * Filters by name, dex number, or type (case-insensitive, 120 ms debounce) and
 * derives duplicate counts + ordering live from the collection store.
 */
export function CollectionScreen({ onSelectCard }: CollectionScreenProps) {
  const { cards, ready } = useCollection();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 120);

  const { results, dupCount } = useMemo(() => {
    const dupMap = findDuplicates(cards);
    const sorted = [...cards].sort((a, b) =>
      a.caughtAt < b.caughtAt ? 1 : a.caughtAt > b.caughtAt ? -1 : 0,
    );
    const q = debouncedQuery.trim().toLowerCase();
    const filtered = q
      ? sorted.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.dexNo.toLowerCase().includes(q) ||
            c.type.toLowerCase().includes(q),
        )
      : sorted;
    return {
      results: filtered,
      dupCount: (dexNo: string) => dupMap.get(dexNo),
    };
  }, [cards, debouncedQuery]);

  if (!ready) return null;

  return (
    <div className="flex flex-col gap-4 px-5 pb-8 pt-5">
      <h1 className="font-display text-3xl tracking-wide text-ink">Collection</h1>

      <div className="sticky top-0 z-10 -mx-5 bg-background px-5 pb-2">
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder="Search by name, dex, type…"
        />
      </div>

      <div className="flex items-center gap-2">
        <span className="eyebrow">All Cards</span>
        <span className="grid min-w-5 place-items-center rounded-full bg-surface-raised px-1.5 font-mono text-[0.62rem] text-ink-muted">
          {results.length}
        </span>
      </div>

      {results.length === 0 ? (
        <p className="pt-6 text-center text-sm text-ink-muted">
          {cards.length === 0
            ? "No cards yet — tap the Pokéball to scan your first card."
            : `No cards match “${debouncedQuery.trim()}”.`}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {results.map((c) => (
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

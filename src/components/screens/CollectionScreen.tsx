"use client";

import { useMemo, useState } from "react";
import type { Card } from "@/types/card";
import { useCollection } from "@/hooks/useCollection";
import { useOwnedCollection } from "@/hooks/useOwnedCollection";
import { useDebounce } from "@/hooks/useDebounce";
import {
  findDuplicates,
  groupByPrinting,
  legacyNewestFirst,
  type PrintingGroup,
} from "@/lib/collection-utils";
import { PrintingTile } from "@/components/card/PrintingTile";
import { SearchBar } from "@/components/collection/SearchBar";
import { CountPill } from "@/components/collection/CountPill";
import { OldCardsSection } from "@/components/collection/OldCardsSection";

interface CollectionScreenProps {
  /** Open the detail sheet for a legacy card. */
  onSelectCard?: (card: Card) => void;
  /** Open the detail sheet for a 2.0 printing. */
  onSelectPrinting?: (group: PrintingGroup) => void;
}

/**
 * Collection screen: one tile per exact printing (newest first, ×N copies),
 * then legacy cards in a labelled "Old cards" grid. The search bar keeps its
 * 120 ms debounce; printings match by name (full search modes are ticket
 * 21.2), legacy cards by name, dex number, or type as before.
 */
export function CollectionScreen({ onSelectCard, onSelectPrinting }: CollectionScreenProps) {
  const { cards, ready } = useCollection();
  const { owned, printings } = useOwnedCollection();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 120);
  const q = debouncedQuery.trim().toLowerCase();

  const allGroups = useMemo(() => groupByPrinting(owned, printings), [owned, printings]);
  const groups = useMemo(
    () => (q ? allGroups.filter((g) => g.printing.name.toLowerCase().includes(q)) : allGroups),
    [allGroups, q],
  );

  const { oldCards, oldDupCount } = useMemo(() => {
    const dupMap = findDuplicates(cards);
    const sorted = legacyNewestFirst(cards);
    return {
      oldCards: q
        ? sorted.filter(
            (c) =>
              c.name.toLowerCase().includes(q) ||
              c.dexNo.toLowerCase().includes(q) ||
              c.type.toLowerCase().includes(q),
          )
        : sorted,
      oldDupCount: (dexNo: string) => dupMap.get(dexNo),
    };
  }, [cards, q]);

  if (!ready) return null;

  const empty = allGroups.length === 0 && cards.length === 0;
  const noMatches = !empty && groups.length === 0 && oldCards.length === 0;

  return (
    <div className="flex flex-col gap-4 px-5 pb-8 pt-5">
      <h1 className="font-display text-3xl tracking-wide text-ink">Collection</h1>

      <div className="sticky top-0 z-10 -mx-5 bg-background px-5 pb-2">
        <SearchBar value={query} onChange={setQuery} placeholder="Search by name…" />
      </div>

      {empty || noMatches ? (
        <p className="pt-6 text-center text-sm text-ink-muted">
          {empty
            ? "No cards yet — tap the Pokéball to scan your first card."
            : `No cards match “${debouncedQuery.trim()}”.`}
        </p>
      ) : (
        <>
          {groups.length > 0 && (
            <section aria-label="All cards" className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="eyebrow">All Cards</span>
                <CountPill count={groups.length} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {groups.map((group) => (
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
            cards={oldCards}
            dupCount={oldDupCount}
            onSelectCard={onSelectCard}
          />
        </>
      )}
    </div>
  );
}

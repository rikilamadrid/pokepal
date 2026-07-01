"use client";

import { useCollection } from "@/hooks/useCollection";
import { findDuplicates, nextDexNumber } from "@/lib/collection-utils";
import type { CardType, Rarity } from "@/types/card";

const TYPES: CardType[] = ["fire", "water", "grass", "electric", "psychic", "rock"];
const RARITIES: Rarity[] = ["common", "uncommon", "rare", "holo"];

/**
 * Temporary phase-2 proof that the local-first store persists across reloads.
 * Shows live counts and exercises every store action. Replaced by the real
 * Home content in phase 5.
 */
export function StoreProof() {
  const { cards, ready, addCard, toggleFavorite, releaseCard, releaseAll } =
    useCollection();

  if (!ready) return <p className="eyebrow">Loading store…</p>;

  const uniqueSpecies = new Set(cards.map((c) => c.dexNo)).size;
  const duplicates = findDuplicates(cards);

  const handleAdd = () => {
    const n = cards.length + 1;
    addCard({
      name: `Testmon ${n}`,
      type: TYPES[n % TYPES.length],
      rarity: RARITIES[n % RARITIES.length],
    });
  };

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
      <p className="eyebrow">Store Proof (phase 2)</p>
      <div className="grid grid-cols-3 gap-2 font-mono text-sm text-ink">
        <span>total {cards.length}</span>
        <span>species {uniqueSpecies}</span>
        <span>dup dex {duplicates.size}</span>
      </div>
      <p className="font-mono text-xs text-ink-muted">
        next dex #{nextDexNumber(cards)}
      </p>
      <div className="flex flex-wrap gap-2">
        <button className="press rounded-lg bg-red px-3 py-1.5 text-sm text-white" onClick={handleAdd}>
          + add card
        </button>
        <button
          className="press rounded-lg border border-border px-3 py-1.5 text-sm text-ink"
          onClick={() => cards[0] && toggleFavorite(cards[0].id)}
        >
          ★ toggle first
        </button>
        <button
          className="press rounded-lg border border-border px-3 py-1.5 text-sm text-ink"
          onClick={() => cards[0] && releaseCard(cards[0].id)}
        >
          release first
        </button>
        <button
          className="press rounded-lg border border-border px-3 py-1.5 text-sm text-ink-muted"
          onClick={releaseAll}
        >
          release all
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto pt-1">
        {cards.slice(0, 8).map((c) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={c.id}
            src={c.img}
            alt={c.name}
            width={48}
            height={48}
            className="shrink-0 rounded-lg border border-border"
            title={`${c.name} #${c.dexNo}${c.favorite ? " ★" : ""}`}
          />
        ))}
      </div>
    </section>
  );
}

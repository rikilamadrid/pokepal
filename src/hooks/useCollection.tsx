"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Card, NewCard } from "@/types/card";
import { createSeedCards } from "@/data/seed";
import { generateCreatureArt } from "@/lib/art-gen";
import { nextDexNumber } from "@/lib/collection-utils";
import { readCollection, writeCollection } from "@/lib/storage";

interface CollectionContextValue {
  cards: Card[];
  /** True until the persisted store has rehydrated (SSR-safe). */
  ready: boolean;
  addCard: (input: NewCard) => Card;
  toggleFavorite: (id: string) => void;
  releaseCard: (id: string) => void;
  releaseAll: () => void;
}

const CollectionContext = createContext<CollectionContextValue | null>(null);

export function CollectionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [cards, setCards] = useState<Card[]>([]);
  const [ready, setReady] = useState(false);
  // avoid persisting the empty pre-hydration state over real data
  const hydrated = useRef(false);

  // Rehydrate from localStorage once on mount; seed on empty. localStorage is
  // unavailable during SSR, so this must run in an effect (a lazy initializer
  // would render empty on the server and mismatch on the client). setState here
  // is the intended one-shot hydration, not a render-driven update.
  useEffect(() => {
    const stored = readCollection();
    const initial = stored && stored.length > 0 ? stored : createSeedCards();
    if (!stored || stored.length === 0) writeCollection(initial);
    hydrated.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot hydration; see comment above
    setCards(initial);
    setReady(true);
  }, []);

  // Persist on every change after hydration.
  useEffect(() => {
    if (hydrated.current) writeCollection(cards);
  }, [cards]);

  const addCard = useCallback((input: NewCard): Card => {
    const now = new Date().toISOString();
    let created!: Card;
    setCards((prev) => {
      const dexNo = input.dexNo?.trim() || nextDexNumber(prev);
      created = {
        id: `card-${Date.now()}`,
        ownerId: "",
        name: input.name,
        dexNo,
        type: input.type,
        rarity: input.rarity,
        favorite: input.favorite ?? false,
        img: input.img || generateCreatureArt(input.name, dexNo, input.type),
        caughtAt: now,
        updatedAt: now,
      };
      return [created, ...prev];
    });
    return created;
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    const now = new Date().toISOString();
    setCards((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, favorite: !c.favorite, updatedAt: now } : c,
      ),
    );
  }, []);

  const releaseCard = useCallback((id: string) => {
    setCards((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const releaseAll = useCallback(() => {
    setCards([]);
  }, []);

  const value = useMemo<CollectionContextValue>(
    () => ({ cards, ready, addCard, toggleFavorite, releaseCard, releaseAll }),
    [cards, ready, addCard, toggleFavorite, releaseCard, releaseAll],
  );

  return (
    <CollectionContext.Provider value={value}>
      {children}
    </CollectionContext.Provider>
  );
}

export function useCollection(): CollectionContextValue {
  const ctx = useContext(CollectionContext);
  if (!ctx) {
    throw new Error("useCollection must be used within a CollectionProvider");
  }
  return ctx;
}

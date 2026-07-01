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
import {
  readCollection,
  readTombstones,
  writeCollection,
  writeTombstones,
  type Tombstones,
} from "@/lib/storage";

/** Changes the sync engine applies to the local store in one pass. */
export interface SyncPatch {
  /** Remote-won cards to insert/update in the live store (their tombstones clear). */
  upsert?: Card[];
  /** Remote-deleted cards: id → deletedAt. Removed from live + tombstoned locally. */
  deletes?: Record<string, string>;
  /** Tombstone ids that are fully reconciled and can be dropped. */
  clearTombstones?: string[];
  /** Stamp this ownerId on every live card still owned by "" (first sign-in). */
  claimOwnerId?: string;
}

interface CollectionContextValue {
  cards: Card[];
  /** Soft-delete tombstones (id → deletedAt ISO) for sync propagation. */
  tombstones: Tombstones;
  /** True until the persisted store has rehydrated (SSR-safe). */
  ready: boolean;
  addCard: (input: NewCard) => Card;
  toggleFavorite: (id: string) => void;
  releaseCard: (id: string) => void;
  releaseAll: () => void;
  /** Apply a batch of reconciled changes from the sync engine. */
  applySync: (patch: SyncPatch) => void;
}

const CollectionContext = createContext<CollectionContextValue | null>(null);

export function CollectionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [cards, setCards] = useState<Card[]>([]);
  const [tombstones, setTombstones] = useState<Tombstones>({});
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
    /* eslint-disable react-hooks/set-state-in-effect -- one-shot hydration; see comment above */
    setCards(initial);
    setTombstones(readTombstones());
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Persist on every change after hydration.
  useEffect(() => {
    if (hydrated.current) writeCollection(cards);
  }, [cards]);

  useEffect(() => {
    if (hydrated.current) writeTombstones(tombstones);
  }, [tombstones]);

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
    const now = new Date().toISOString();
    setCards((prev) => prev.filter((c) => c.id !== id));
    // Tombstone so the release propagates to the cloud (and other devices) and
    // isn't resurrected by a later pull.
    setTombstones((prev) => ({ ...prev, [id]: now }));
  }, []);

  const releaseAll = useCallback(() => {
    const now = new Date().toISOString();
    setCards((prev) => {
      setTombstones((tombs) => {
        const next = { ...tombs };
        for (const c of prev) next[c.id] = now;
        return next;
      });
      return [];
    });
  }, []);

  const applySync = useCallback((patch: SyncPatch) => {
    const { upsert, deletes, clearTombstones, claimOwnerId } = patch;
    const upsertIds = new Set((upsert ?? []).map((c) => c.id));
    const deleteIds = deletes ?? {};

    setCards((prev) => {
      const byId = new Map(prev.map((c) => [c.id, c]));
      for (const c of upsert ?? []) byId.set(c.id, c);
      for (const id of Object.keys(deleteIds)) byId.delete(id);
      let next = [...byId.values()];
      if (claimOwnerId) {
        next = next.map((c) =>
          c.ownerId === "" ? { ...c, ownerId: claimOwnerId } : c,
        );
      }
      return next;
    });

    setTombstones((prev) => {
      const next = { ...prev };
      for (const id of upsertIds) delete next[id]; // resurrected → drop tombstone
      for (const id of clearTombstones ?? []) delete next[id];
      for (const [id, deletedAt] of Object.entries(deleteIds)) next[id] = deletedAt;
      return next;
    });
  }, []);

  const value = useMemo<CollectionContextValue>(
    () => ({
      cards,
      tombstones,
      ready,
      addCard,
      toggleFavorite,
      releaseCard,
      releaseAll,
      applySync,
    }),
    [
      cards,
      tombstones,
      ready,
      addCard,
      toggleFavorite,
      releaseCard,
      releaseAll,
      applySync,
    ],
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

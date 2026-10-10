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
import type { OwnedCard, OwnershipSummary } from "@/types/collection";
import {
  readOwnedCards,
  readOwnedTombstones,
  readPrintings,
  writeOwnedCards,
  writeOwnedTombstones,
  writePrintings,
  type PrintingCache,
  type Tombstones,
} from "@/lib/storage";
import {
  createOwnedCards,
  EMPTY_OWNED_STATE,
  insertOwnedBatch,
  releaseOwnedCopy,
  toggleOwnedFavorite,
  type NewOwnedCard,
  type OwnedState,
} from "@/lib/owned-cards";
import { ownershipFor, printingDuplicates } from "@/lib/collection-utils";

/**
 * PokéPal 2.0 owned-card store: physical copies (`OwnedCard`) of catalog
 * printings, plus the on-device printing cache. Lives beside the legacy
 * `CollectionProvider`, which it never reads or writes.
 */
interface OwnedCollectionContextValue {
  /** Live copies, newest first. */
  owned: OwnedCard[];
  /** Cached printing snapshots, keyed by printing id. */
  printings: PrintingCache;
  /** Released copies (id → deletedAt ISO), for sync. */
  tombstones: Tombstones;
  /** Add a batch of copies in one atomic update; returns the new OwnedCards. */
  addOwnedCards: (items: readonly NewOwnedCard[]) => OwnedCard[];
  toggleFavorite: (id: string) => void;
  /** Release one physical copy (other copies of the printing stay). */
  releaseCopy: (id: string) => void;
  ownershipFor: (printingId: string) => OwnershipSummary;
  /** Printing ids owned more than once → copy count. */
  printingDuplicates: () => Map<string, number>;
}

const OwnedCollectionContext =
  createContext<OwnedCollectionContextValue | null>(null);

/** Dev-only: `?seed-v2` adds fixture printings to an empty 2.0 store. */
const DEV_SEED_PARAM = "seed-v2";

export function OwnedCollectionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<OwnedState>(EMPTY_OWNED_STATE);
  // Avoid persisting the empty pre-hydration state over real data.
  const hydrated = useRef(false);

  // One-shot hydration from localStorage (unavailable during SSR).
  useEffect(() => {
    const initial: OwnedState = {
      owned: readOwnedCards(),
      printings: readPrintings(),
      tombstones: readOwnedTombstones(),
    };
    hydrated.current = true;
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot hydration */
    setState(initial);

    if (
      process.env.NODE_ENV === "development" &&
      initial.owned.length === 0 &&
      new URLSearchParams(window.location.search).has(DEV_SEED_PARAM)
    ) {
      void import("@/data/dev-owned-seed").then(({ DEV_OWNED_SEED }) => {
        const batch = createOwnedCards(DEV_OWNED_SEED);
        setState((prev) =>
          prev.owned.length === 0 ? insertOwnedBatch(prev, batch) : prev,
        );
      });
    }
  }, []);

  // Persist on every change after hydration.
  useEffect(() => {
    if (!hydrated.current) return;
    writeOwnedCards(state.owned);
    writePrintings(state.printings);
    writeOwnedTombstones(state.tombstones);
  }, [state]);

  const addOwnedCards = useCallback(
    (items: readonly NewOwnedCard[]): OwnedCard[] => {
      // Validate and mint ids once, outside the updater, so a re-run updater
      // (StrictMode) can never produce a second set of ids.
      const batch = createOwnedCards(items);
      setState((prev) => insertOwnedBatch(prev, batch));
      return batch.added;
    },
    [],
  );

  const toggleFavorite = useCallback((id: string) => {
    const at = new Date().toISOString();
    setState((prev) => toggleOwnedFavorite(prev, id, at));
  }, []);

  const releaseCopy = useCallback((id: string) => {
    const at = new Date().toISOString();
    setState((prev) => releaseOwnedCopy(prev, id, at));
  }, []);

  const duplicates = useMemo(() => printingDuplicates(state.owned), [state.owned]);

  const ownershipForPrinting = useCallback(
    (printingId: string) => ownershipFor(state.owned, printingId),
    [state.owned],
  );

  const printingDuplicatesFn = useCallback(() => duplicates, [duplicates]);

  const value = useMemo<OwnedCollectionContextValue>(
    () => ({
      owned: state.owned,
      printings: state.printings,
      tombstones: state.tombstones,
      addOwnedCards,
      toggleFavorite,
      releaseCopy,
      ownershipFor: ownershipForPrinting,
      printingDuplicates: printingDuplicatesFn,
    }),
    [
      state,
      addOwnedCards,
      toggleFavorite,
      releaseCopy,
      ownershipForPrinting,
      printingDuplicatesFn,
    ],
  );

  return (
    <OwnedCollectionContext.Provider value={value}>
      {children}
    </OwnedCollectionContext.Provider>
  );
}

export function useOwnedCollection(): OwnedCollectionContextValue {
  const ctx = useContext(OwnedCollectionContext);
  if (!ctx) {
    throw new Error(
      "useOwnedCollection must be used within an OwnedCollectionProvider",
    );
  }
  return ctx;
}

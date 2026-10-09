import { z } from "zod";
import type { CardFinish, CardPrinting } from "@/types/catalog";
import type { AcquisitionSource, OwnedCard } from "@/types/collection";
import { cardFinishSchema, cardPrintingSchema } from "@/types/catalog.schema";
import { acquisitionSourceSchema } from "@/types/collection.schema";
import {
  isStorablePrinting,
  type PrintingCache,
  type Tombstones,
} from "@/lib/storage";

/**
 * Pure state transitions for the 2.0 owned-card store. The React provider
 * (`useOwnedCollection`) holds one `OwnedState` and applies these, so every
 * mutation is a single atomic state update and is testable without React.
 */
export interface OwnedState {
  /** Live copies, newest first. */
  owned: OwnedCard[];
  /** Printing snapshots for every printing added on this device. */
  printings: PrintingCache;
  /** Released copies (id → deletedAt ISO), for 18.3 sync. */
  tombstones: Tombstones;
}

/** One copy to add: the verified printing plus the facts about the copy. */
export interface NewOwnedCard {
  printing: CardPrinting;
  source: AcquisitionSource;
  finish?: CardFinish | null;
  favorite?: boolean;
}

export const EMPTY_OWNED_STATE: OwnedState = {
  owned: [],
  printings: {},
  tombstones: {},
};

const newOwnedCardSchema = z.strictObject({
  printing: cardPrintingSchema.refine(isStorablePrinting, {
    message: "printing image must be a catalog URL, never inline image data",
    path: ["imageUrl"],
  }),
  source: acquisitionSourceSchema,
  finish: cardFinishSchema.nullable().optional(),
  favorite: z.boolean().optional(),
});

export interface AddOptions {
  now?: () => Date;
  newId?: () => string;
}

/** A validated batch: the new copies and the printing snapshots they reference. */
export interface OwnedBatch {
  added: OwnedCard[];
  printings: CardPrinting[];
}

/**
 * Build the OwnedCards for a batch. Every item is Zod-validated first; one
 * invalid item rejects the whole batch (throws), so a batch is all-or-nothing.
 * Each copy gets its own `crypto.randomUUID()`.
 */
export function createOwnedCards(
  items: readonly NewOwnedCard[],
  { now = () => new Date(), newId = () => crypto.randomUUID() }: AddOptions = {},
): OwnedBatch {
  const parsed = items.map((item) => newOwnedCardSchema.parse(item));
  const at = now().toISOString();
  return {
    added: parsed.map((item) => ({
      id: newId(),
      ownerId: "",
      printingId: item.printing.id,
      finish: item.finish ?? null,
      favorite: item.favorite ?? false,
      source: item.source,
      acquiredAt: at,
      storageLocationId: null,
      updatedAt: at,
    })),
    printings: parsed.map((item) => item.printing),
  };
}

/** Insert a built batch (newest first) and cache its printings, in one new state. */
export function insertOwnedBatch(state: OwnedState, batch: OwnedBatch): OwnedState {
  if (batch.added.length === 0) return state;
  const printings: PrintingCache = { ...state.printings };
  for (const printing of batch.printings) printings[printing.id] = printing;
  return { ...state, owned: [...batch.added, ...state.owned], printings };
}

/** `createOwnedCards` + `insertOwnedBatch`: the whole add as one transition. */
export function addOwnedCardsTo(
  state: OwnedState,
  items: readonly NewOwnedCard[],
  options: AddOptions = {},
): { state: OwnedState; added: OwnedCard[] } {
  const batch = createOwnedCards(items, options);
  return { state: insertOwnedBatch(state, batch), added: batch.added };
}

/** Flip one copy's favorite flag and bump its `updatedAt`. Unknown id → unchanged. */
export function toggleOwnedFavorite(
  state: OwnedState,
  id: string,
  at: string = new Date().toISOString(),
): OwnedState {
  if (!state.owned.some((card) => card.id === id)) return state;
  return {
    ...state,
    owned: state.owned.map((card) =>
      card.id === id ? { ...card, favorite: !card.favorite, updatedAt: at } : card,
    ),
  };
}

/**
 * Release one physical copy: remove it and tombstone its id so the release can
 * propagate on sync. Other copies of the same printing are untouched, and the
 * printing snapshot stays cached. Unknown id → unchanged.
 */
export function releaseOwnedCopy(
  state: OwnedState,
  id: string,
  at: string = new Date().toISOString(),
): OwnedState {
  if (!state.owned.some((card) => card.id === id)) return state;
  return {
    ...state,
    owned: state.owned.filter((card) => card.id !== id),
    tombstones: { ...state.tombstones, [id]: at },
  };
}

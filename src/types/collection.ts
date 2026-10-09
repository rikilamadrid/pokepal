/**
 * PokéPal 2.0 collection contract — verbatim from
 * context/pokepal-2/02-target-architecture.md §Domain boundaries.
 * Change the contract there, not here.
 */

import type { CardFinish } from "@/types/catalog";

export type AcquisitionSource = "scan" | "manual" | "trade" | "legacy-migration";

/** One physical copy Dalí owns. Quantity = count of live OwnedCards per printing. */
export interface OwnedCard {
  id: string;               // crypto.randomUUID() — never time-based
  ownerId: string;          // Supabase user id, "" while local-only
  printingId: string;       // → CardPrinting.id
  finish: CardFinish | null;// null = unknown/not recorded
  favorite: boolean;
  source: AcquisitionSource;
  acquiredAt: string;       // ISO
  storageLocationId: string | null; // future StorageLocation; always null in 2.0
  updatedAt: string;        // ISO; LWW sync
}

/** Future — contract only. Not rendered, not synced in 2.0. */
export interface StorageLocation {
  id: string;
  ownerId: string;
  kind: "album" | "tin" | "box" | "deck";
  name: string;
  updatedAt: string;
}

/** Derived, never stored. */
export interface OwnershipSummary {
  printingId: string;
  copies: number;           // live OwnedCards with this printingId
  finishes: Partial<Record<CardFinish, number>>;
}

export type CardType =
  | "fire"
  | "water"
  | "grass"
  | "electric"
  | "psychic"
  | "rock";

export type Rarity = "common" | "uncommon" | "rare" | "holo";

export interface Card {
  /** "card-{timestamp}" or "seed-{n}" */
  id: string;
  /** Supabase user id; empty string while local-only / signed out */
  ownerId: string;
  name: string;
  /** zero-padded 3-digit, e.g. "008" */
  dexNo: string;
  type: CardType;
  rarity: Rarity;
  favorite: boolean;
  /** base64 JPEG data URI (local) | Storage URL (synced) | generated SVG data URI */
  img: string;
  /** ISO 8601 timestamp */
  caughtAt: string;
  /** ISO 8601 — bumped on every mutation for sync reconciliation */
  updatedAt: string;
}

/** Shape passed to the store's addCard action — the store fills the rest. */
export type NewCard = Pick<Card, "name" | "type" | "rarity"> &
  Partial<Pick<Card, "dexNo" | "img" | "favorite">>;

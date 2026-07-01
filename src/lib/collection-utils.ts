import type { Card } from "@/types/card";

/**
 * Dex numbers that appear more than once in the collection, mapped to their
 * count. Computed on read — there is no stored duplicate field. Used by the
 * home "duplicates" row and the `×N` card badge.
 */
export function findDuplicates(cards: Card[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const card of cards) {
    counts.set(card.dexNo, (counts.get(card.dexNo) ?? 0) + 1);
  }
  const duplicates = new Map<string, number>();
  for (const [dexNo, count] of counts) {
    if (count > 1) duplicates.set(dexNo, count);
  }
  return duplicates;
}

/** True when another card shares this card's dex number. */
export function isDuplicate(cards: Card[], dexNo: string): boolean {
  let seen = 0;
  for (const card of cards) {
    if (card.dexNo === dexNo && ++seen > 1) return true;
  }
  return false;
}

/**
 * Next dex number for the Scan form's blank-dex auto-increment: highest numeric
 * dex in the collection + 1, zero-padded to 3 digits. Empty collection → "001".
 */
export function nextDexNumber(cards: Card[]): string {
  let max = 0;
  for (const card of cards) {
    const n = parseInt(card.dexNo, 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return String(max + 1).padStart(3, "0");
}

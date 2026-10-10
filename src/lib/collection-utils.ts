import type { Card } from "@/types/card";
import type { CardFinish, CardPrinting } from "@/types/catalog";
import type { OwnedCard, OwnershipSummary } from "@/types/collection";
import { regionForDexNo } from "@/lib/catalog/regions";

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

// ---- PokéPal 2.0: exact-printing selectors ------------------------------------
// Ownership is counted per `printingId` only — never by name, species, or dex —
// so two printings of the same Pokémon are never duplicates of each other.

/** Copies of one exact printing among the live OwnedCards, with a per-finish tally. */
export function ownershipFor(
  owned: readonly OwnedCard[],
  printingId: string,
): OwnershipSummary {
  const finishes: OwnershipSummary["finishes"] = {};
  let copies = 0;
  for (const card of owned) {
    if (card.printingId !== printingId) continue;
    copies++;
    if (card.finish) finishes[card.finish] = (finishes[card.finish] ?? 0) + 1;
  }
  return { printingId, copies, finishes };
}

/**
 * Printing ids owned more than once, mapped to their copy count — the 2.0
 * counterpart of `findDuplicates`, which stays dex-based for legacy cards.
 */
export function printingDuplicates(
  owned: readonly OwnedCard[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const card of owned) {
    counts.set(card.printingId, (counts.get(card.printingId) ?? 0) + 1);
  }
  const duplicates = new Map<string, number>();
  for (const [printingId, count] of counts) {
    if (count > 1) duplicates.set(printingId, count);
  }
  return duplicates;
}

// ---- PokéPal 2.0: view selectors ----------------------------------------------

/** Every live copy of one exact printing, ready to render as one tile. */
export interface PrintingGroup {
  printing: CardPrinting;
  /** Copies of this printing, newest acquisition first. */
  copies: OwnedCard[];
  /** Number of copies — the tile's ×N. */
  count: number;
  /** True when at least one copy is a favorite. */
  favorite: boolean;
  /** Most recent `acquiredAt` among the copies (ISO). */
  latestAcquiredAt: string;
  /** Copies per recorded finish. */
  finishes: OwnershipSummary["finishes"];
  /** Copies with no recorded finish. */
  unknownFinish: number;
}

const newestFirst = (a: string, b: string) => (a < b ? 1 : a > b ? -1 : 0);

/**
 * Group live OwnedCards into one entry per exact printing, newest acquisition
 * first. Copies whose printing snapshot is missing from the cache cannot be
 * drawn and are left out.
 */
export function groupByPrinting(
  owned: readonly OwnedCard[],
  printings: Readonly<Record<string, CardPrinting>>,
): PrintingGroup[] {
  const byId = new Map<string, OwnedCard[]>();
  for (const card of owned) {
    if (!printings[card.printingId]) continue;
    const copies = byId.get(card.printingId);
    if (copies) copies.push(card);
    else byId.set(card.printingId, [card]);
  }
  const groups: PrintingGroup[] = [];
  for (const [printingId, copies] of byId) {
    copies.sort((a, b) => newestFirst(a.acquiredAt, b.acquiredAt));
    const { finishes } = ownershipFor(copies, printingId);
    groups.push({
      printing: printings[printingId],
      copies,
      count: copies.length,
      favorite: copies.some((card) => card.favorite),
      latestAcquiredAt: copies[0].acquiredAt,
      finishes,
      unknownFinish: copies.filter((card) => card.finish === null).length,
    });
  }
  return groups.sort((a, b) => newestFirst(a.latestAcquiredAt, b.latestAcquiredAt));
}

/** Printings with at least one favorite copy, in the given order. */
export function favoritePrintingGroups(groups: readonly PrintingGroup[]): PrintingGroup[] {
  return groups.filter((group) => group.favorite);
}

/** Printings owned more than once, in the given order. */
export function duplicatePrintingGroups(groups: readonly PrintingGroup[]): PrintingGroup[] {
  return groups.filter((group) => group.count > 1);
}

/**
 * The copy "release one" removes: the newest copy that is not a favorite, so a
 * starred copy is kept as long as possible; the newest copy when all are starred.
 */
export function copyToRelease(group: PrintingGroup): OwnedCard {
  return group.copies.find((card) => !card.favorite) ?? group.copies[0];
}

/**
 * Copy ids to flip for the printing-level favorite button: un-star every
 * starred copy when the printing is a favorite, otherwise star the newest copy.
 */
export function favoriteToggleIds(group: PrintingGroup): string[] {
  if (group.favorite) {
    return group.copies.filter((card) => card.favorite).map((card) => card.id);
  }
  return [group.copies[0].id];
}

/** Printed collector number with the set denominator, e.g. "20/189"; "TG05" as-is. */
export function formatCollectorNumber(printing: CardPrinting): string {
  const { collectorNumber, set } = printing;
  return /^\d+$/.test(collectorNumber) && set.officialCount > 0
    ? `${collectorNumber}/${set.officialCount}`
    : collectorNumber;
}

/** "#006 Kanto" per species on the card; [] for trainers and energy. */
export function dexLabels(printing: CardPrinting): string[] {
  return printing.dexNos.map((dexNo) => {
    const region = regionForDexNo(dexNo);
    const number = `#${String(dexNo).padStart(3, "0")}`;
    return region ? `${number} ${region[0].toUpperCase()}${region.slice(1)}` : number;
  });
}

const FINISH_LABELS: Record<CardFinish, string> = {
  normal: "Normal",
  holo: "Holo",
  reverse: "Reverse holo",
  firstEdition: "1st edition",
};

/** Copies by finish for the detail sheet, e.g. ["2 Holo", "1 finish not recorded"]. */
export function finishBreakdown(group: PrintingGroup): string[] {
  const lines = (Object.keys(FINISH_LABELS) as CardFinish[])
    .filter((finish) => (group.finishes[finish] ?? 0) > 0)
    .map((finish) => `${group.finishes[finish]} ${FINISH_LABELS[finish]}`);
  if (group.unknownFinish > 0) lines.push(`${group.unknownFinish} finish not recorded`);
  return lines;
}

/** Legacy cards, newest catch first (copy; the input is not mutated). */
export function legacyNewestFirst(cards: readonly Card[]): Card[] {
  return [...cards].sort((a, b) => newestFirst(a.caughtAt, b.caughtAt));
}

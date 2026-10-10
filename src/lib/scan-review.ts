import type { NewOwnedCard } from "@/lib/owned-cards";
import type { CardPrinting } from "@/types/catalog";
import type { AcquisitionSource } from "@/types/collection";
import type { ExtractedCardFields, ScanBatch, ScanCandidate } from "@/types/scan";

/**
 * Pure review model for Batch Scan: a `ScanBatch` becomes a list of review
 * items the child confirms, corrects, or removes before one save. Holds no
 * photo data — only what recognition and the catalog returned.
 *
 * No silent acceptance: only an `exact` candidate starts selected (it is still
 * shown in review before save); `ambiguous` needs an explicit choice and
 * `unmatched` needs a manual search or removal. While any kept item has no
 * choice, nothing can be saved.
 */

export interface ReviewItem {
  candidate: ScanCandidate;
  /** "scan" for cards read off the photo, "manual" for cards added by search. */
  source: AcquisitionSource;
}

/** Live copies Dalí already owns of one printing. */
export type CopiesOf = (printingId: string) => number;

export interface ReviewSummary {
  /** Kept items with a chosen printing — what "Add N cards" saves. */
  toAdd: number;
  /** Kept items still waiting for a choice. Any > 0 blocks save. */
  needsChoice: number;
  rejected: number;
}

const NOTHING_READ: ExtractedCardFields = {
  name: null,
  collectorNumber: null,
  setOfficialCount: null,
  setCodeHint: null,
  hp: null,
  language: null,
  regulationMark: null,
  finishHint: null,
  bbox: null,
  modelConfidence: 0,
};

/** Start a review from a recognized batch: exact cards pre-selected, the rest pending. */
export function startReview(batch: ScanBatch, copiesOf: CopiesOf): ReviewItem[] {
  return batch.candidates.map((candidate) => {
    const top = candidate.matches[0]?.printing;
    const preselect = candidate.tier === "exact" && top !== undefined;
    return {
      source: "scan",
      candidate: {
        ...candidate,
        chosenPrintingId: preselect ? top.id : null,
        status: preselect ? "confirmed" : "pending",
        ownedCopies: preselect ? copiesOf(top.id) : 0,
      },
    };
  });
}

function update(
  items: readonly ReviewItem[],
  id: string,
  change: (candidate: ScanCandidate) => ScanCandidate,
): ReviewItem[] {
  return items.map((item) =>
    item.candidate.id === id ? { ...item, candidate: change(item.candidate) } : item,
  );
}

/** Choose one of a candidate's ranked printings. A printing not in its matches is ignored. */
export function choosePrinting(
  items: readonly ReviewItem[],
  id: string,
  printingId: string,
  copiesOf: CopiesOf,
): ReviewItem[] {
  return update(items, id, (c) => {
    const index = c.matches.findIndex((m) => m.printing.id === printingId);
    if (index === -1) return c;
    return {
      ...c,
      chosenPrintingId: printingId,
      status: index === 0 ? "confirmed" : "corrected",
      ownedCopies: copiesOf(printingId),
    };
  });
}

/** Correct a candidate with a printing found by manual search. */
export function correctWithPrinting(
  items: readonly ReviewItem[],
  id: string,
  printing: CardPrinting,
  copiesOf: CopiesOf,
): ReviewItem[] {
  return update(items, id, (c) => ({
    ...c,
    matches: [
      { printing, score: 0, reasons: ["search"] },
      ...c.matches.filter((m) => m.printing.id !== printing.id),
    ],
    chosenPrintingId: printing.id,
    status: "corrected",
    ownedCopies: copiesOf(printing.id),
  }));
}

/** Add a card the child found by search (nothing was read off a photo for it). */
export function addSearchedCard(
  items: readonly ReviewItem[],
  printing: CardPrinting,
  copiesOf: CopiesOf,
  newId: () => string = () => crypto.randomUUID(),
): ReviewItem[] {
  const candidate: ScanCandidate = {
    id: newId(),
    extracted: NOTHING_READ,
    tier: "unmatched",
    matches: [{ printing, score: 0, reasons: ["search"] }],
    chosenPrintingId: printing.id,
    status: "corrected",
    ownedCopies: copiesOf(printing.id),
  };
  return [...items, { candidate, source: "manual" }];
}

/** Remove a card from this scan; it will not be saved. */
export function rejectCandidate(items: readonly ReviewItem[], id: string): ReviewItem[] {
  return update(items, id, (c) => ({ ...c, chosenPrintingId: null, status: "rejected", ownedCopies: 0 }));
}

export function reviewSummary(items: readonly ReviewItem[]): ReviewSummary {
  let toAdd = 0;
  let needsChoice = 0;
  let rejected = 0;
  for (const { candidate } of items) {
    if (candidate.status === "rejected") rejected++;
    else if (candidate.chosenPrintingId === null) needsChoice++;
    else toAdd++;
  }
  return { toAdd, needsChoice, rejected };
}

/** True when every kept card has a choice and at least one card will be added. */
export function canSave(items: readonly ReviewItem[]): boolean {
  const { toAdd, needsChoice } = reviewSummary(items);
  return needsChoice === 0 && toAdd > 0;
}

/** The chosen printing of a kept item, or null while it waits for a choice. */
export function chosenPrinting(candidate: ScanCandidate): CardPrinting | null {
  if (candidate.status === "rejected" || candidate.chosenPrintingId === null) return null;
  return candidate.matches.find((m) => m.printing.id === candidate.chosenPrintingId)?.printing ?? null;
}

/**
 * The copies to save, one per confirmed/corrected card. Throws while any kept
 * card still needs a choice, so an uncertain card can never be saved.
 */
export function toNewOwnedCards(items: readonly ReviewItem[]): NewOwnedCard[] {
  if (reviewSummary(items).needsChoice > 0) {
    throw new Error("Every card needs a choice before saving");
  }
  return items.flatMap(({ candidate, source }) => {
    const printing = chosenPrinting(candidate);
    return printing ? [{ printing, source }] : [];
  });
}

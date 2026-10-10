import { describe, expect, it } from "vitest";
import { DEV_PRINTINGS } from "@/data/dev-owned-seed";
import { DEV_SCAN_EXTRACTIONS, createDevScanTransport } from "@/data/dev-scan-fixture";
import { createFixtureTransport, recognize } from "@/lib/recognition";
import { EMPTY_OWNED_STATE, addOwnedCardsTo, type OwnedState } from "@/lib/owned-cards";
import { ownershipFor } from "@/lib/collection-utils";
import {
  addSearchedCard,
  canSave,
  choosePrinting,
  correctWithPrinting,
  rejectCandidate,
  reviewSummary,
  startReview,
  toNewOwnedCards,
  type ReviewItem,
} from "@/lib/scan-review";
import { createMemoryCatalog, recordedPrinting } from "../helpers/memory-catalog";

/**
 * Batch Scan, end to end without the UI: photo → recognize (fixture
 * transport over recorded TCGdex printings) → review → addOwnedCards.
 */

const SENTINEL = "PHOTO-BYTES-SENTINEL-20-1";
const photo = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff]), SENTINEL], { type: "image/jpeg" });
const prepare = async (image: Blob) => new Blob([await image.arrayBuffer()], { type: "image/jpeg" });

function transport() {
  return createFixtureTransport({ extractions: DEV_SCAN_EXTRACTIONS, catalog: createMemoryCatalog() });
}

async function scanInto(state: OwnedState): Promise<ReviewItem[]> {
  const batch = await recognize(photo(), { mode: "batch", transport: transport(), prepare });
  return startReview(batch, (id) => ownershipFor(state.owned, id).copies);
}

const copiesIn = (state: OwnedState) => (id: string) => ownershipFor(state.owned, id).copies;
const ids = (items: ReviewItem[]) => items.map((i) => i.candidate.id);

describe("Batch Scan review over a recorded 6-card photo", () => {
  it("produces one review row per card: exact pre-selected, ambiguous and unmatched pending", async () => {
    const items = await scanInto(EMPTY_OWNED_STATE);

    expect(items.map((i) => i.candidate.tier)).toEqual([
      "exact", "exact", "ambiguous", "exact", "unmatched", "exact",
    ]);
    expect(items.map((i) => i.candidate.chosenPrintingId)).toEqual([
      "tcgdex:en:swsh3-20",
      "tcgdex:es:swsh3-20",
      null,
      "tcgdex:en:swsh1-178",
      null,
      "tcgdex:ja:SV2a-006",
    ]);
    expect(items.every((i) => i.source === "scan")).toBe(true);
    expect(items[2].candidate.matches.length).toBeGreaterThan(1);
    expect(reviewSummary(items)).toEqual({ toAdd: 4, needsChoice: 2, rejected: 0 });
  });

  it("blocks save while an ambiguous or unmatched card has no choice", async () => {
    let items = await scanInto(EMPTY_OWNED_STATE);
    const [, , ambiguous, , unmatched] = ids(items);

    expect(canSave(items)).toBe(false);
    expect(() => toNewOwnedCards(items)).toThrow();

    items = rejectCandidate(items, unmatched);
    expect(canSave(items)).toBe(false); // the ambiguous card still needs a choice
    expect(() => toNewOwnedCards(items)).toThrow();

    const second = items[2].candidate.matches[1].printing.id;
    items = choosePrinting(items, ambiguous, second, () => 0);
    expect(canSave(items)).toBe(true);
    expect(items[2].candidate.status).toBe("corrected");
  });

  it("saves exactly the confirmed cards in one addOwnedCards batch with source scan", async () => {
    const before = EMPTY_OWNED_STATE;
    let items = await scanInto(before);
    const [first, , ambiguous, , unmatched] = ids(items);

    const picked = items[2].candidate.matches[0].printing.id;
    items = choosePrinting(items, ambiguous, picked, copiesIn(before));
    items = rejectCandidate(items, unmatched);
    items = rejectCandidate(items, first); // the child removes a card he does not want

    const toSave = toNewOwnedCards(items);
    const { state, added } = addOwnedCardsTo(before, toSave);

    expect(added.map((c) => c.printingId)).toEqual([
      "tcgdex:es:swsh3-20",
      picked,
      "tcgdex:en:swsh1-178",
      "tcgdex:ja:SV2a-006",
    ]);
    expect(added.every((c) => c.source === "scan")).toBe(true);
    expect(state.owned).toHaveLength(4);
    expect(Object.keys(state.printings).sort()).toEqual(
      [...new Set(added.map((c) => c.printingId))].sort(),
    );
  });

  it("corrects an unmatched card by search and adds a searched card as manual", async () => {
    let items = await scanInto(EMPTY_OWNED_STATE);
    const [, , ambiguous, , unmatched] = ids(items);
    const searched = recordedPrinting("en", "hgss1-116");
    const extra = recordedPrinting("en", "swsh3.5-74");

    items = correctWithPrinting(items, unmatched, searched, () => 0);
    items = choosePrinting(items, ambiguous, items[2].candidate.matches[0].printing.id, () => 0);
    items = addSearchedCard(items, extra, () => 0, () => "manual-1");

    const toSave = toNewOwnedCards(items);
    expect(toSave).toHaveLength(7);
    expect(toSave[4]).toEqual({ printing: searched, source: "scan" });
    expect(toSave[6]).toEqual({ printing: extra, source: "manual" });
  });

  it("ignores a choice that is not one of the candidate's printings", async () => {
    const items = await scanInto(EMPTY_OWNED_STATE);
    const ambiguous = items[2].candidate.id;
    const after = choosePrinting(items, ambiguous, "tcgdex:en:not-offered", () => 0);
    expect(after[2].candidate.chosenPrintingId).toBeNull();
  });

  it("shows 'you have N' for exact printings already owned", async () => {
    const owned = addOwnedCardsTo(EMPTY_OWNED_STATE, [
      { printing: recordedPrinting("en", "swsh3-20"), source: "manual" },
      { printing: recordedPrinting("en", "swsh3-20"), source: "manual" },
    ]).state;
    const items = await scanInto(owned);
    expect(items[0].candidate.ownedCopies).toBe(2);
    expect(items[1].candidate.ownedCopies).toBe(0); // the Spanish printing is a different card
  });

  it("keeps no photo data in the review or the saved state", async () => {
    let items = await scanInto(EMPTY_OWNED_STATE);
    items = rejectCandidate(rejectCandidate(items, items[2].candidate.id), items[4].candidate.id);
    const { state } = addOwnedCardsTo(EMPTY_OWNED_STATE, toNewOwnedCards(items));

    for (const value of [items, state]) {
      const json = JSON.stringify(value);
      expect(json).not.toContain(SENTINEL);
      expect(json).not.toContain(Buffer.from(SENTINEL).toString("base64"));
      expect(json).not.toMatch(/data:image/i);
    }
  });
});

describe("dev scan fixture", () => {
  it("resolves the same tiers against the dev printings as against the recorded catalog", async () => {
    const batch = await recognize(photo(), {
      mode: "batch",
      transport: { recognize: (req) => createDevScanTransport().recognize(req) },
      prepare,
    });
    expect(batch.candidates.map((c) => c.tier)).toEqual([
      "exact", "exact", "ambiguous", "exact", "unmatched", "exact",
    ]);
    const devIds = new Set(DEV_PRINTINGS.map((p) => p.id));
    for (const c of batch.candidates) {
      for (const m of c.matches) expect(devIds.has(m.printing.id)).toBe(true);
    }
  });
});

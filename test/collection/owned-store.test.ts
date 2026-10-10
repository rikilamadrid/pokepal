import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Card } from "@/types/card";
import type { CardPrinting } from "@/types/catalog";
import { ownedCardSchema } from "@/types/collection.schema";
import { mapTcgdexCard } from "@/lib/catalog/tcgdex";
import {
  findDuplicates,
  ownershipFor,
  printingDuplicates,
} from "@/lib/collection-utils";
import {
  addOwnedCardsTo,
  EMPTY_OWNED_STATE,
  releaseOwnedCopy,
  toggleOwnedFavorite,
  type NewOwnedCard,
  type OwnedState,
} from "@/lib/owned-cards";
import {
  COLLECTION_KEY,
  OWNED_KEY,
  OWNED_TOMBSTONES_KEY,
  PRINTINGS_KEY,
  TOMBSTONES_KEY,
  UPLOADED_KEY,
  readCollection,
  readOwnedCards,
  readOwnedTombstones,
  readPrintings,
  readTombstones,
  readUploadedIds,
  writeOwnedCards,
  writeOwnedTombstones,
  writePrintings,
} from "@/lib/storage";
import { DEV_OWNED_SEED, DEV_PRINTINGS } from "@/data/dev-owned-seed";
import { loadFixture } from "../helpers/tcgdex-fixtures";

const FETCHED_AT = "2026-10-09T12:00:00.000Z";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function printingFrom(path: string, lang: "en" | "es" | "ja"): CardPrinting {
  return mapTcgdexCard(loadFixture(path), lang, FETCHED_AT);
}

const charizardEn = printingFrom("/en/cards/swsh3-20", "en");
const charizardEs = printingFrom("/es/cards/swsh3-20", "es");
const charizardChampionsPath = printingFrom("/en/cards/swsh3.5-74", "en");

/** In-memory localStorage behind a stubbed `window`, as the browser would give. */
function stubLocalStorage(): Map<string, string> {
  const store = new Map<string, string>();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, String(value)),
      removeItem: (key: string) => void store.delete(key),
      clear: () => store.clear(),
    },
  });
  return store;
}

function persist(state: OwnedState): void {
  writeOwnedCards(state.owned);
  writePrintings(state.printings);
  writeOwnedTombstones(state.tombstones);
}

function reload(): OwnedState {
  return {
    owned: readOwnedCards(),
    printings: readPrintings(),
    tombstones: readOwnedTombstones(),
  };
}

const copies = (printing: CardPrinting, n: number): NewOwnedCard[] =>
  Array.from({ length: n }, () => ({ printing, source: "scan" as const }));

let storage: Map<string, string>;
beforeEach(() => {
  storage = stubLocalStorage();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("addOwnedCards batch", () => {
  it("gives a 10-item batch 10 unique UUIDs in one state transition", () => {
    const { state, added } = addOwnedCardsTo(EMPTY_OWNED_STATE, copies(charizardEn, 10));

    expect(added).toHaveLength(10);
    expect(state.owned).toEqual(added);
    expect(new Set(added.map((c) => c.id)).size).toBe(10);
    for (const card of added) {
      expect(card.id).toMatch(UUID);
      expect(ownedCardSchema.safeParse(card).success).toBe(true);
      expect(card).toMatchObject({
        ownerId: "",
        printingId: "tcgdex:en:swsh3-20",
        storageLocationId: null,
        favorite: false,
        finish: null,
      });
    }
    expect(Object.keys(state.printings)).toEqual(["tcgdex:en:swsh3-20"]);
  });

  it("keeps earlier copies and puts the new batch first", () => {
    const first = addOwnedCardsTo(EMPTY_OWNED_STATE, copies(charizardEn, 1));
    const second = addOwnedCardsTo(first.state, copies(charizardEs, 2));
    expect(second.state.owned.map((c) => c.printingId)).toEqual([
      "tcgdex:es:swsh3-20",
      "tcgdex:es:swsh3-20",
      "tcgdex:en:swsh3-20",
    ]);
  });

  it("rejects the whole batch when one item is invalid", () => {
    const photo = { ...charizardEn, imageUrl: "data:image/jpeg;base64,/9j/4AAQ" };
    expect(() =>
      addOwnedCardsTo(EMPTY_OWNED_STATE, [
        ...copies(charizardEn, 2),
        { printing: photo, source: "scan" },
      ]),
    ).toThrow();
    expect(() =>
      addOwnedCardsTo(EMPTY_OWNED_STATE, [
        { printing: charizardEn, source: "found-on-floor" as "scan" },
      ]),
    ).toThrow();
  });

  it("returns the same state for an empty batch", () => {
    expect(addOwnedCardsTo(EMPTY_OWNED_STATE, []).state).toBe(EMPTY_OWNED_STATE);
  });
});

describe("exact-printing ownership", () => {
  it("never counts two Charizard printings as duplicates of each other", () => {
    const { state } = addOwnedCardsTo(EMPTY_OWNED_STATE, [
      { printing: charizardEn, source: "scan" },
      { printing: charizardChampionsPath, source: "scan" },
      { printing: charizardEs, source: "scan" },
    ]);
    expect(charizardEn.name).toBe(charizardChampionsPath.name);
    expect(printingDuplicates(state.owned).size).toBe(0);
    for (const id of [charizardEn.id, charizardChampionsPath.id, charizardEs.id]) {
      expect(ownershipFor(state.owned, id).copies).toBe(1);
    }
  });

  it("counts ×3 for three copies of one printing, with a finish tally", () => {
    const { state } = addOwnedCardsTo(EMPTY_OWNED_STATE, [
      { printing: charizardEn, source: "scan", finish: "holo" },
      { printing: charizardEn, source: "scan", finish: "holo" },
      { printing: charizardEn, source: "scan" },
      { printing: charizardChampionsPath, source: "scan" },
    ]);
    expect(printingDuplicates(state.owned)).toEqual(new Map([[charizardEn.id, 3]]));
    expect(ownershipFor(state.owned, charizardEn.id)).toEqual({
      printingId: charizardEn.id,
      copies: 3,
      finishes: { holo: 2 },
    });
    expect(ownershipFor(state.owned, "tcgdex:en:nope-1").copies).toBe(0);
  });
});

describe("favorite and release", () => {
  it("toggles one copy's favorite and bumps only its updatedAt", () => {
    const { state, added } = addOwnedCardsTo(EMPTY_OWNED_STATE, copies(charizardEn, 2), {
      now: () => new Date(FETCHED_AT),
    });
    const later = "2026-10-10T08:00:00.000Z";
    const next = toggleOwnedFavorite(state, added[0].id, later);
    expect(next.owned[0]).toMatchObject({ favorite: true, updatedAt: later });
    expect(next.owned[1]).toEqual(added[1]);
    expect(toggleOwnedFavorite(state, "missing", later)).toBe(state);
  });

  it("releases one copy, tombstones it, and keeps the other copies and the printing", () => {
    const { state, added } = addOwnedCardsTo(EMPTY_OWNED_STATE, copies(charizardEn, 3));
    const at = "2026-10-10T08:00:00.000Z";
    const next = releaseOwnedCopy(state, added[1].id, at);
    expect(next.owned.map((c) => c.id)).toEqual([added[0].id, added[2].id]);
    expect(next.tombstones).toEqual({ [added[1].id]: at });
    expect(next.printings[charizardEn.id]).toEqual(charizardEn);
    expect(ownershipFor(next.owned, charizardEn.id).copies).toBe(2);
    expect(releaseOwnedCopy(state, "missing", at)).toBe(state);
  });
});

describe("v2 persistence", () => {
  it("round-trips owned cards, printings and tombstones through a reload", () => {
    let { state } = addOwnedCardsTo(EMPTY_OWNED_STATE, [
      ...copies(charizardEn, 3),
      { printing: charizardEs, source: "manual", finish: "holo", favorite: true },
    ]);
    state = releaseOwnedCopy(state, state.owned[0].id, "2026-10-10T08:00:00.000Z");
    persist(state);

    expect(reload()).toEqual(state);
    expect([...storage.keys()].sort()).toEqual(
      [OWNED_KEY, OWNED_TOMBSTONES_KEY, PRINTINGS_KEY].sort(),
    );
  });

  it("persists no inline image payloads for 2.0 records", () => {
    const { state } = addOwnedCardsTo(EMPTY_OWNED_STATE, [...DEV_OWNED_SEED]);
    persist(state);
    for (const key of [OWNED_KEY, PRINTINGS_KEY, OWNED_TOMBSTONES_KEY]) {
      expect(storage.get(key)).not.toMatch(/data:image/);
    }
  });

  it("drops invalid, duplicate, mis-keyed and photo-bearing records on read", () => {
    const { added } = addOwnedCardsTo(EMPTY_OWNED_STATE, copies(charizardEn, 1));
    storage.set(
      OWNED_KEY,
      JSON.stringify([added[0], added[0], { ...added[0], id: "card-123" }, "junk", null]),
    );
    storage.set(
      PRINTINGS_KEY,
      JSON.stringify({
        [charizardEn.id]: charizardEn,
        "tcgdex:es:wrong-key": charizardEs,
        [charizardEs.id]: { ...charizardEs, imageUrl: "data:image/png;base64,iVBOR" },
        "tcgdex:en:swsh3.5-74": { ...charizardChampionsPath, price: 12 },
      }),
    );
    storage.set(
      OWNED_TOMBSTONES_KEY,
      JSON.stringify({ ok: "2026-10-10T08:00:00.000Z", bad: "not a date", "": FETCHED_AT }),
    );

    expect(readOwnedCards()).toEqual([added[0]]);
    expect(readPrintings()).toEqual({ [charizardEn.id]: charizardEn });
    expect(readOwnedTombstones()).toEqual({ ok: "2026-10-10T08:00:00.000Z" });
  });

  it("reads an empty store when the v2 keys are absent or corrupt", () => {
    expect(reload()).toEqual(EMPTY_OWNED_STATE);
    storage.set(OWNED_KEY, "{not json");
    storage.set(PRINTINGS_KEY, "[]");
    storage.set(OWNED_TOMBSTONES_KEY, "42");
    expect(reload()).toEqual(EMPTY_OWNED_STATE);
  });
});

describe("legacy collection is preserved", () => {
  const PHOTO = `data:image/jpeg;base64,${"/9j/4AAQSkZJRgABAQAAAQABAAD".repeat(40)}`;
  const legacyCards: Card[] = [
    {
      id: "card-1760000000000",
      ownerId: "user-a",
      name: "Charizard",
      dexNo: "006",
      type: "fire",
      rarity: "holo",
      favorite: true,
      img: PHOTO,
      caughtAt: "2026-07-01T10:00:00.000Z",
      updatedAt: "2026-07-02T10:00:00.000Z",
    },
    {
      id: "card-1760000000001",
      ownerId: "",
      name: "Charizard",
      dexNo: "006",
      type: "fire",
      rarity: "rare",
      favorite: false,
      img: PHOTO.replace("jpeg", "png"),
      caughtAt: "2026-07-03T10:00:00.000Z",
      updatedAt: "2026-07-03T10:00:00.000Z",
    },
  ];
  const legacyRaw = {
    [COLLECTION_KEY]: JSON.stringify(legacyCards),
    [TOMBSTONES_KEY]: JSON.stringify({ "seed-3": "2026-07-04T10:00:00.000Z" }),
    [UPLOADED_KEY]: JSON.stringify(["card-1760000000000"]),
  };

  it("loads a legacy payload with photo data URIs unchanged", () => {
    for (const [key, value] of Object.entries(legacyRaw)) storage.set(key, value);

    expect(readCollection()).toEqual(legacyCards);
    expect(readTombstones()).toEqual({ "seed-3": "2026-07-04T10:00:00.000Z" });
    expect(readUploadedIds()).toEqual(new Set(["card-1760000000000"]));
    expect(findDuplicates(readCollection() ?? [])).toEqual(new Map([["006", 2]]));
  });

  it("never reads or writes a legacy key from the v2 store", () => {
    for (const [key, value] of Object.entries(legacyRaw)) storage.set(key, value);

    expect(reload()).toEqual(EMPTY_OWNED_STATE);
    let { state } = addOwnedCardsTo(EMPTY_OWNED_STATE, [...DEV_OWNED_SEED]);
    state = toggleOwnedFavorite(state, state.owned[0].id);
    state = releaseOwnedCopy(state, state.owned[1].id);
    persist(state);

    for (const [key, value] of Object.entries(legacyRaw)) {
      expect(storage.get(key)).toBe(value);
    }
    expect(readCollection()).toEqual(legacyCards);
  });
});

describe("dev seed", () => {
  it("is exactly the adapter's mapping of the recorded fixtures", () => {
    expect(DEV_PRINTINGS).toEqual([
      charizardEn,
      charizardEs,
      charizardChampionsPath,
      printingFrom("/ja/cards/SV2a-006", "ja"),
      printingFrom("/en/cards/swsh1-178", "en"),
      printingFrom("/en/cards/30th-c-001", "en"),
    ]);
  });

  it("produces a valid batch with one ×3 printing", () => {
    const { state } = addOwnedCardsTo(EMPTY_OWNED_STATE, [...DEV_OWNED_SEED]);
    expect(state.owned).toHaveLength(8);
    expect(printingDuplicates(state.owned)).toEqual(new Map([[charizardEn.id, 3]]));
    expect(Object.keys(state.printings)).toHaveLength(6);
  });
});

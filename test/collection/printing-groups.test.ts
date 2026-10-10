import { describe, expect, it } from "vitest";
import type { Card } from "@/types/card";
import type { CardFinish, CardPrinting } from "@/types/catalog";
import type { OwnedCard } from "@/types/collection";
import { catalogImageSrc, mapTcgdexCard } from "@/lib/catalog/tcgdex";
import {
  copyToRelease,
  dexLabels,
  duplicatePrintingGroups,
  favoritePrintingGroups,
  favoriteToggleIds,
  finishBreakdown,
  formatCollectorNumber,
  groupByPrinting,
  legacyNewestFirst,
} from "@/lib/collection-utils";
import {
  addOwnedCardsTo,
  EMPTY_OWNED_STATE,
  releaseOwnedCopy,
  toggleOwnedFavorite,
} from "@/lib/owned-cards";
import { DEV_OWNED_SEED, DEV_PRINTINGS } from "@/data/dev-owned-seed";
import { loadFixture } from "../helpers/tcgdex-fixtures";

const FETCHED_AT = "2026-10-09T12:00:00.000Z";

function printingFrom(path: string, lang: "en" | "es" | "ja"): CardPrinting {
  return mapTcgdexCard(loadFixture(path), lang, FETCHED_AT);
}

const charizardEn = printingFrom("/en/cards/swsh3-20", "en");
const charizardEs = printingFrom("/es/cards/swsh3-20", "es");
const charizardChampionsPath = printingFrom("/en/cards/swsh3.5-74", "en");
const research = printingFrom("/en/cards/swsh1-178", "en");
const noImage = printingFrom("/en/cards/30th-c-001", "en");
const tagTeamPromo = printingFrom("/en/cards/swshp-SWSH261", "en");

const cache = (...printings: CardPrinting[]) =>
  Object.fromEntries(printings.map((p) => [p.id, p]));

let seq = 0;
function copy(
  printing: CardPrinting,
  acquiredAt: string,
  extra: { finish?: CardFinish | null; favorite?: boolean } = {},
): OwnedCard {
  seq++;
  return {
    id: `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`,
    ownerId: "",
    printingId: printing.id,
    finish: extra.finish ?? null,
    favorite: extra.favorite ?? false,
    source: "manual",
    acquiredAt,
    storageLocationId: null,
    updatedAt: acquiredAt,
  };
}

describe("groupByPrinting", () => {
  it("shows two printings of Charizard as two tiles", () => {
    const owned = [
      copy(charizardEn, "2026-10-01T00:00:00.000Z"),
      copy(charizardChampionsPath, "2026-10-02T00:00:00.000Z"),
    ];
    const groups = groupByPrinting(owned, cache(charizardEn, charizardChampionsPath));
    expect(groups.map((g) => [g.printing.id, g.count])).toEqual([
      [charizardChampionsPath.id, 1],
      [charizardEn.id, 1],
    ]);
  });

  it("shows three copies of one printing as one tile with ×3", () => {
    const owned = [
      copy(charizardEn, "2026-10-01T00:00:00.000Z"),
      copy(charizardEn, "2026-10-03T00:00:00.000Z"),
      copy(charizardEn, "2026-10-02T00:00:00.000Z"),
    ];
    const [group, ...rest] = groupByPrinting(owned, cache(charizardEn));
    expect(rest).toEqual([]);
    expect(group.count).toBe(3);
    expect(group.copies.map((c) => c.acquiredAt)).toEqual([
      "2026-10-03T00:00:00.000Z",
      "2026-10-02T00:00:00.000Z",
      "2026-10-01T00:00:00.000Z",
    ]);
    expect(group.latestAcquiredAt).toBe("2026-10-03T00:00:00.000Z");
  });

  it("never merges the same card in two languages", () => {
    const owned = [
      copy(charizardEn, "2026-10-01T00:00:00.000Z"),
      copy(charizardEs, "2026-10-01T00:00:00.000Z"),
    ];
    const groups = groupByPrinting(owned, cache(charizardEn, charizardEs));
    expect(groups).toHaveLength(2);
    expect(groups.every((g) => g.count === 1)).toBe(true);
  });

  it("orders printings by their newest copy", () => {
    const owned = [
      copy(research, "2026-10-05T00:00:00.000Z"),
      copy(charizardEn, "2026-10-01T00:00:00.000Z"),
      copy(charizardEn, "2026-10-09T00:00:00.000Z"),
    ];
    const groups = groupByPrinting(owned, cache(research, charizardEn));
    expect(groups.map((g) => g.printing.id)).toEqual([charizardEn.id, research.id]);
  });

  it("tallies finishes and unrecorded finishes", () => {
    const owned = [
      copy(research, "2026-10-01T00:00:00.000Z", { finish: "holo" }),
      copy(research, "2026-10-02T00:00:00.000Z", { finish: "reverse" }),
      copy(research, "2026-10-03T00:00:00.000Z", { finish: "holo" }),
      copy(research, "2026-10-04T00:00:00.000Z"),
    ];
    const [group] = groupByPrinting(owned, cache(research));
    expect(group.finishes).toEqual({ holo: 2, reverse: 1 });
    expect(group.unknownFinish).toBe(1);
    expect(finishBreakdown(group)).toEqual([
      "2 Holo",
      "1 Reverse holo",
      "1 finish not recorded",
    ]);
  });

  it("is favorite when any copy is a favorite", () => {
    const owned = [
      copy(charizardEn, "2026-10-01T00:00:00.000Z"),
      copy(charizardEn, "2026-10-02T00:00:00.000Z", { favorite: true }),
    ];
    expect(groupByPrinting(owned, cache(charizardEn))[0].favorite).toBe(true);
  });

  it("leaves out copies whose printing snapshot is not cached", () => {
    const owned = [
      copy(charizardEn, "2026-10-01T00:00:00.000Z"),
      copy(research, "2026-10-02T00:00:00.000Z"),
    ];
    const groups = groupByPrinting(owned, cache(charizardEn));
    expect(groups.map((g) => g.printing.id)).toEqual([charizardEn.id]);
  });

  it("returns nothing for an empty collection", () => {
    expect(groupByPrinting([], {})).toEqual([]);
  });
});

describe("favorite and duplicate rows", () => {
  const owned = [
    copy(charizardEn, "2026-10-01T00:00:00.000Z"),
    copy(charizardEn, "2026-10-02T00:00:00.000Z"),
    copy(charizardChampionsPath, "2026-10-03T00:00:00.000Z", { favorite: true }),
    copy(research, "2026-10-04T00:00:00.000Z"),
  ];
  const groups = groupByPrinting(owned, cache(charizardEn, charizardChampionsPath, research));

  it("favorites are printings with a starred copy", () => {
    expect(favoritePrintingGroups(groups).map((g) => g.printing.id)).toEqual([
      charizardChampionsPath.id,
    ]);
  });

  it("duplicates are exact printings owned more than once — not same-species cards", () => {
    expect(duplicatePrintingGroups(groups).map((g) => [g.printing.id, g.count])).toEqual([
      [charizardEn.id, 2],
    ]);
  });
});

describe("detail sheet actions", () => {
  it("release one removes the newest non-favorite copy and keeps the rest", () => {
    const starred = copy(charizardEn, "2026-10-09T00:00:00.000Z", { favorite: true });
    const plainNew = copy(charizardEn, "2026-10-05T00:00:00.000Z");
    const plainOld = copy(charizardEn, "2026-10-01T00:00:00.000Z");
    const [group] = groupByPrinting([plainOld, starred, plainNew], cache(charizardEn));
    expect(copyToRelease(group).id).toBe(plainNew.id);
  });

  it("release one falls back to the newest copy when every copy is starred", () => {
    const a = copy(charizardEn, "2026-10-01T00:00:00.000Z", { favorite: true });
    const b = copy(charizardEn, "2026-10-02T00:00:00.000Z", { favorite: true });
    const [group] = groupByPrinting([a, b], cache(charizardEn));
    expect(copyToRelease(group).id).toBe(b.id);
  });

  it("favorite stars the newest copy; unfavorite clears every starred copy", () => {
    const { state } = addOwnedCardsTo(EMPTY_OWNED_STATE, [
      { printing: charizardEn, source: "manual" },
      { printing: charizardEn, source: "manual" },
    ]);
    const [group] = groupByPrinting(state.owned, state.printings);
    expect(group.favorite).toBe(false);

    const starIds = favoriteToggleIds(group);
    expect(starIds).toEqual([group.copies[0].id]);
    const starred = starIds.reduce((s, id) => toggleOwnedFavorite(s, id), state);
    const [starredGroup] = groupByPrinting(starred.owned, starred.printings);
    expect(starredGroup.favorite).toBe(true);

    // A second starred copy (e.g. from sync) is cleared too.
    const both = toggleOwnedFavorite(starred, starredGroup.copies[1].id);
    const [bothGroup] = groupByPrinting(both.owned, both.printings);
    const unstarred = favoriteToggleIds(bothGroup).reduce(
      (s, id) => toggleOwnedFavorite(s, id),
      both,
    );
    expect(groupByPrinting(unstarred.owned, unstarred.printings)[0].favorite).toBe(false);
  });

  it("releasing one of three copies leaves ×2 of the same printing", () => {
    const { state } = addOwnedCardsTo(EMPTY_OWNED_STATE, [...DEV_OWNED_SEED]);
    const before = groupByPrinting(state.owned, state.printings).find(
      (g) => g.printing.id === charizardEn.id,
    );
    expect(before?.count).toBe(3);
    const after = releaseOwnedCopy(state, copyToRelease(before!).id);
    const group = groupByPrinting(after.owned, after.printings).find(
      (g) => g.printing.id === charizardEn.id,
    );
    expect(group?.count).toBe(2);
    // The starred copy survives the release.
    expect(group?.favorite).toBe(true);
  });
});

describe("dev seed grouping", () => {
  it("renders six tiles, one ×3, with one printing that has no image", () => {
    const { state } = addOwnedCardsTo(EMPTY_OWNED_STATE, [...DEV_OWNED_SEED]);
    const groups = groupByPrinting(state.owned, state.printings);
    expect(groups).toHaveLength(DEV_PRINTINGS.length);
    expect(groups.filter((g) => g.count > 1).map((g) => [g.printing.id, g.count])).toEqual([
      [charizardEn.id, 3],
    ]);
    expect(groups.filter((g) => g.printing.imageUrl === null).map((g) => g.printing.id)).toEqual([
      noImage.id,
    ]);
  });
});

describe("printing labels", () => {
  it("formats numeric collector numbers with the set's printed count", () => {
    expect(formatCollectorNumber(charizardEn)).toBe("20/189");
    expect(formatCollectorNumber(noImage)).toBe("001/30");
  });

  it("leaves alphanumeric collector numbers as printed", () => {
    expect(formatCollectorNumber(tagTeamPromo)).toBe(tagTeamPromo.collectorNumber);
    expect(tagTeamPromo.collectorNumber).toMatch(/\D/);
  });

  it("labels Pokédex numbers with their region; none for trainers", () => {
    expect(dexLabels(charizardEn)).toEqual(["#006 Kanto"]);
    expect(dexLabels(research)).toEqual([]);
  });
});

describe("catalogImageSrc", () => {
  it("appends the TCGdex quality and format to the base URL", () => {
    expect(catalogImageSrc(charizardEn.imageUrl, "low")).toBe(
      "https://assets.tcgdex.net/en/swsh/swsh3/20/low.webp",
    );
    expect(catalogImageSrc(charizardEn.imageUrl, "high")).toBe(
      "https://assets.tcgdex.net/en/swsh/swsh3/20/high.webp",
    );
  });

  it("returns null for a printing without an image (→ placeholder)", () => {
    expect(catalogImageSrc(noImage.imageUrl, "low")).toBeNull();
  });
});

describe("legacyNewestFirst", () => {
  it("sorts legacy cards newest catch first without mutating the input", () => {
    const base: Omit<Card, "id" | "caughtAt"> = {
      ownerId: "",
      name: "Tidaltail",
      dexNo: "008",
      type: "water",
      rarity: "holo",
      favorite: false,
      img: "",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const cards: Card[] = [
      { ...base, id: "a", caughtAt: "2026-01-01T00:00:00.000Z" },
      { ...base, id: "b", caughtAt: "2026-03-01T00:00:00.000Z" },
    ];
    expect(legacyNewestFirst(cards).map((c) => c.id)).toEqual(["b", "a"]);
    expect(cards.map((c) => c.id)).toEqual(["a", "b"]);
  });
});

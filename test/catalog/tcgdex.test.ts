import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CatalogError,
  collectorNumberVariants,
  createTcgdexFetch,
  createTcgdexProvider,
  mapCategory,
  mapEnergyTypes,
  mapTcgdexCard,
} from "@/lib/catalog/tcgdex";
import { CATALOG_LANGUAGES, cardPrintingSchema } from "@/types/catalog.schema";
import type { CardPrinting } from "@/types/catalog";
import { createFixtureFetch, loadFixture } from "../helpers/tcgdex-fixtures";

const FETCHED_AT = "2026-10-09T12:00:00.000Z";
const now = () => new Date(FETCHED_AT);

const CONTRACT_KEYS = [
  "availableFinishes",
  "category",
  "collectorNumber",
  "dexNos",
  "energyTypes",
  "fetchedAt",
  "hp",
  "id",
  "illustrator",
  "imageUrl",
  "language",
  "name",
  "provider",
  "providerCardId",
  "rarity",
  "regulationMark",
  "set",
  "stage",
];

function provider(requested: string[] = []) {
  return createTcgdexProvider({ fetchJson: createFixtureFetch(requested), now });
}

function expectNoPricing(printing: CardPrinting) {
  const json = JSON.stringify(printing);
  expect(json).not.toMatch(/pricing|cardmarket|tcgplayer|variants_detailed/i);
  expect(Object.keys(printing).sort()).toEqual(CONTRACT_KEYS);
}

describe("mapTcgdexCard", () => {
  it("maps swsh3-20 (Charizard VMAX) to the exact contract fields", () => {
    const raw = loadFixture("/en/cards/swsh3-20");
    expect(JSON.stringify(raw)).toMatch(/pricing/); // the fixture really carries pricing
    const printing = mapTcgdexCard(raw, "en", FETCHED_AT);
    expect(printing).toEqual({
      id: "tcgdex:en:swsh3-20",
      provider: "tcgdex",
      providerCardId: "swsh3-20",
      language: "en",
      name: "Charizard VMAX",
      category: "pokemon",
      collectorNumber: "20",
      set: {
        id: "swsh3",
        name: "Darkness Ablaze",
        officialCount: 189,
        totalCount: 201,
        releaseDate: null,
        symbolUrl: "https://assets.tcgdex.net/univ/swsh/swsh3/symbol",
        logoUrl: "https://assets.tcgdex.net/en/swsh/swsh3/logo",
      },
      rarity: "Holo Rare VMAX",
      energyTypes: ["fire"],
      stage: "VMAX",
      hp: 330,
      dexNos: [6],
      illustrator: "aky CG Works",
      regulationMark: "D",
      availableFinishes: ["holo"],
      imageUrl: "https://assets.tcgdex.net/en/swsh/swsh3/20",
      fetchedAt: FETCHED_AT,
    });
    expectNoPricing(printing);
    expect(cardPrintingSchema.safeParse(printing).success).toBe(true);
  });

  it("maps a card with no image, no rarity, and no set art to nulls (30th-c-001)", () => {
    const printing = mapTcgdexCard(loadFixture("/en/cards/30th-c-001"), "en", FETCHED_AT);
    expect(printing.imageUrl).toBeNull();
    expect(printing.rarity).toBeNull();
    expect(printing.set.logoUrl).toBeNull();
    expect(printing.set.symbolUrl).toBeNull();
    expect(printing.regulationMark).toBeNull();
    expect(printing.collectorNumber).toBe("001");
    expect(printing.set.officialCount).toBe(30);
    expectNoPricing(printing);
  });

  it("maps a trainer: no energy types, no species, no hp, both finishes", () => {
    const printing = mapTcgdexCard(loadFixture("/en/cards/swsh1-178"), "en", FETCHED_AT);
    expect(printing.category).toBe("trainer");
    expect(printing.name).toBe("Professor's Research (Professor Magnolia)");
    expect(printing.energyTypes).toEqual([]);
    expect(printing.dexNos).toEqual([]);
    expect(printing.hp).toBeNull();
    expect(printing.availableFinishes).toEqual(["holo", "reverse"]);
    expectNoPricing(printing);
  });

  it("maps an Energy card whose TCGdex hp is 0 to hp null (hgss1-116)", () => {
    const raw = loadFixture("/en/cards/hgss1-116") as { hp?: unknown };
    expect(raw.hp).toBe(0); // the recorded response really carries hp 0
    const printing = mapTcgdexCard(raw, "en", FETCHED_AT);
    expect(printing).toMatchObject({
      id: "tcgdex:en:hgss1-116",
      name: "Fire Energy",
      category: "energy",
      hp: null,
      energyTypes: ["fire"],
    });
    expectNoPricing(printing);
  });

  it("maps a Japanese card with the requested language", () => {
    const printing = mapTcgdexCard(loadFixture("/ja/cards/SV2a-006"), "ja", FETCHED_AT);
    expect(printing).toMatchObject({
      id: "tcgdex:ja:SV2a-006",
      language: "ja",
      name: "リザードンex",
      collectorNumber: "006",
      set: { id: "SV2a", name: "ポケモンカード151", officialCount: 165, totalCount: 210 },
      energyTypes: ["fire"],
      dexNos: [6],
      regulationMark: "G",
      imageUrl: "https://assets.tcgdex.net/ja/SV/SV2a/006",
    });
    expectNoPricing(printing);
  });

  it("maps variants to finishes in contract order", () => {
    const raw = {
      ...(loadFixture("/en/cards/swsh3-20") as object),
      variants: { normal: true, reverse: true, holo: true, firstEdition: true, wPromo: true },
    };
    expect(mapTcgdexCard(raw, "en", FETCHED_AT).availableFinishes).toEqual([
      "normal",
      "holo",
      "reverse",
      "firstEdition",
    ]);
  });

  it("rejects malformed responses with a CatalogError", () => {
    expect(() => mapTcgdexCard({ id: "x" }, "en", FETCHED_AT)).toThrow(CatalogError);
    const badCategory = { ...(loadFixture("/en/cards/swsh3-20") as object), category: "Item" };
    expect(() => mapTcgdexCard(badCategory, "en", FETCHED_AT)).toThrow(CatalogError);
  });
});

describe("Spanish (es) cards", () => {
  it("maps the es Charizard VMAX with localized category, type, and a language-qualified id", () => {
    const raw = loadFixture("/es/cards/swsh3-20") as { category: string; types: string[] };
    expect(raw.category).toBe("Pokémon"); // recorded localized names
    expect(raw.types).toEqual(["Fuego"]);
    const printing = mapTcgdexCard(raw, "es", FETCHED_AT);
    expect(printing).toMatchObject({
      id: "tcgdex:es:swsh3-20",
      providerCardId: "swsh3-20",
      language: "es",
      name: "Charizard VMAX",
      category: "pokemon",
      energyTypes: ["fire"],
      rarity: "Holo Rara VMAX",
      dexNos: [6],
      set: { id: "swsh3", name: "Oscuridad Incandescente", officialCount: 189 },
      imageUrl: "https://assets.tcgdex.net/es/swsh/swsh3/20",
    });
    expectNoPricing(printing);
    expect(cardPrintingSchema.safeParse(printing).success).toBe(true);
  });

  it("maps the es trainer (Entrenador)", () => {
    const raw = loadFixture("/es/cards/swsh1-178") as { category: string };
    expect(raw.category).toBe("Entrenador");
    const printing = mapTcgdexCard(raw, "es", FETCHED_AT);
    expect(printing).toMatchObject({
      id: "tcgdex:es:swsh1-178",
      category: "trainer",
      name: "Investigación de Profesores",
      energyTypes: [],
      dexNos: [],
      hp: null,
    });
    expectNoPricing(printing);
  });

  it("gives the en and es copies of one card different printing ids", () => {
    const en = mapTcgdexCard(loadFixture("/en/cards/swsh3-20"), "en", FETCHED_AT);
    const es = mapTcgdexCard(loadFixture("/es/cards/swsh3-20"), "es", FETCHED_AT);
    expect(en.providerCardId).toBe(es.providerCardId);
    expect(en.id).not.toBe(es.id);
  });

  it("rejects a localized type name from an unsupported language instead of dropping it", () => {
    const raw = { ...(loadFixture("/es/cards/swsh3-20") as object), types: ["Feu"] };
    expect(() => mapTcgdexCard(raw, "es", FETCHED_AT)).toThrow(CatalogError);
    const enRaw = { ...(loadFixture("/en/cards/swsh3-20") as object), types: ["Fuego"] };
    expect(() => mapTcgdexCard(enRaw, "en", FETCHED_AT)).toThrow(CatalogError);
  });
});

describe("mapEnergyTypes / mapCategory", () => {
  it("maps all eleven English TCG energy types case-insensitively, deduplicated", () => {
    expect(
      mapEnergyTypes(
        [
          "Grass", "Fire", "Water", "Lightning", "Psychic", "Fighting",
          "Darkness", "Metal", "Fairy", "Dragon", "Colorless", "fire",
        ],
        "en",
      ),
    ).toEqual([
      "grass", "fire", "water", "lightning", "psychic", "fighting",
      "darkness", "metal", "fairy", "dragon", "colorless",
    ]);
    expect(mapEnergyTypes(undefined, "en")).toEqual([]);
    expect(mapEnergyTypes([], "es")).toEqual([]);
  });

  it("throws on an unknown type name rather than mapping it to []", () => {
    expect(() => mapEnergyTypes(["Electric"], "en")).toThrow(CatalogError);
    expect(() => mapEnergyTypes(["Fire", "Feuer"], "en")).toThrow(CatalogError);
  });

  it("maps the Spanish energy-type names", () => {
    expect(
      mapEnergyTypes(
        ["Planta", "Fuego", "Agua", "Rayo", "Psíquico", "Lucha", "Oscura", "Metálica", "Hada", "Dragón", "Incolora"],
        "es",
      ),
    ).toEqual([
      "grass", "fire", "water", "lightning", "psychic", "fighting",
      "darkness", "metal", "fairy", "dragon", "colorless",
    ]);
    // Decomposed accents (NFD) still map.
    expect(mapEnergyTypes(["Psíquico".normalize("NFD")], "es")).toEqual(["psychic"]);
  });

  it.each(CATALOG_LANGUAGES)("maps every recorded TCGdex type and category name for %s", (lang) => {
    const types = loadFixture(`/${lang}/types`) as string[];
    const categories = loadFixture(`/${lang}/categories`) as string[];
    expect(types).toHaveLength(11);
    expect(new Set(mapEnergyTypes(types, lang)).size).toBe(11);
    expect(categories.map((c) => mapCategory(c, lang)).sort()).toEqual([
      "energy",
      "pokemon",
      "trainer",
    ]);
  });
});

describe("collectorNumberVariants", () => {
  it("tries the printed spelling, the bare number, and the 3-digit form", () => {
    expect(collectorNumberVariants("20")).toEqual(["20", "020"]);
    expect(collectorNumberVariants("020")).toEqual(["020", "20"]);
    expect(collectorNumberVariants(" 1 ")).toEqual(["1", "001"]);
    expect(collectorNumberVariants("TG05")).toEqual(["TG05"]);
    expect(collectorNumberVariants("  ")).toEqual([]);
  });
});

describe("createTcgdexProvider (recorded fixtures)", () => {
  it("getPrinting accepts a language-qualified or bare id", async () => {
    const p = provider();
    const qualified = await p.getPrinting("tcgdex:en:swsh3-20", "en");
    const bare = await p.getPrinting("swsh3-20", "en");
    expect(qualified?.id).toBe("tcgdex:en:swsh3-20");
    expect(bare).toEqual(qualified);
  });

  it("getPrinting fetches a Spanish printing by its qualified id", async () => {
    const requested: string[] = [];
    const printing = await provider(requested).getPrinting("tcgdex:es:swsh3-20", "es");
    expect(printing?.id).toBe("tcgdex:es:swsh3-20");
    expect(printing?.category).toBe("pokemon");
    expect(printing?.energyTypes).toEqual(["fire"]);
    expect(requested).toEqual(["/es/cards/swsh3-20"]);
  });

  it("getPrinting rejects a qualified id in another language or a malformed one", async () => {
    const requested: string[] = [];
    const p = provider(requested);
    await expect(p.getPrinting("tcgdex:es:swsh3-20", "en")).rejects.toThrow(RangeError);
    await expect(p.getPrinting("tcgdex:swsh3-20", "en")).rejects.toThrow(RangeError);
    await expect(p.getPrinting("tcgdex:fr:swsh3-20", "en")).rejects.toThrow(RangeError);
    expect(requested).toEqual([]);
  });

  it("getPrinting returns null for an unknown card", async () => {
    expect(await provider().getPrinting("does-not-exist", "en")).toBeNull();
  });

  it("findByNumber returns every printing with that number in a set of that size", async () => {
    const requested: string[] = [];
    const results = await provider(requested).findByNumber("20", 189, "en");
    expect(results.map((r) => r.id)).toEqual(["tcgdex:en:swsh3-20", "tcgdex:en:swsh10-020"]);
    expect(results.every((r) => r.set.officialCount === 189)).toBe(true);
    expect(requested[0]).toBe("/en/sets?cardCount.official=eq%3A189");
  });

  it("findByNumber resolves a zero-padded printed number", async () => {
    const results = await provider().findByNumber("020", 189, "en");
    expect(results.map((r) => r.id)).toEqual(["tcgdex:en:swsh3-20", "tcgdex:en:swsh10-020"]);
  });

  it("findByNumber rejects empty input without calling the catalog", async () => {
    const requested: string[] = [];
    expect(await provider(requested).findByNumber("", 189, "en")).toEqual([]);
    expect(await provider(requested).findByNumber("20", 0, "en")).toEqual([]);
    expect(requested).toEqual([]);
  });

  it("searchByName returns validated printings, including one with no image", async () => {
    const results = await provider().searchByName("Charizard VMAX", "en");
    expect(results.map((r) => r.id)).toEqual([
      "tcgdex:en:swsh3-20",
      "tcgdex:en:swsh3.5-74",
      "tcgdex:en:swsh4.5sv-SV107",
      "tcgdex:en:swshp-SWSH261",
    ]);
    expect(results.find((r) => r.id === "tcgdex:en:swsh4.5sv-SV107")?.imageUrl).toBeNull();
    results.forEach(expectNoPricing);
  });

  it("searchByName caps results", async () => {
    const p = createTcgdexProvider({ fetchJson: createFixtureFetch(), now, maxSearchResults: 2 });
    expect(await p.searchByName("Charizard VMAX", "en")).toHaveLength(2);
  });
});

describe("createTcgdexFetch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("turns a 200 response with a non-JSON body into a CatalogError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>maintenance</html>", { status: 200 })),
    );
    await expect(createTcgdexFetch()("/en/cards/swsh3-20")).rejects.toThrow(CatalogError);
  });

  it("returns null on 404 and throws CatalogError on other HTTP errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
    expect(await createTcgdexFetch()("/en/cards/nope")).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));
    await expect(createTcgdexFetch()("/en/cards/swsh3-20")).rejects.toThrow(CatalogError);
  });
});

describe.runIf(process.env.LIVE_CATALOG === "1")("TCGdex live check", () => {
  it("fetches swsh3-20 from the real API and validates it", async () => {
    const printing = await createTcgdexProvider().getPrinting("swsh3-20", "en");
    expect(printing).not.toBeNull();
    expect(cardPrintingSchema.parse(printing)).toMatchObject({
      id: "tcgdex:en:swsh3-20",
      name: "Charizard VMAX",
      collectorNumber: "20",
      set: { id: "swsh3", officialCount: 189 },
      dexNos: [6],
    });
    expectNoPricing(printing as CardPrinting);
  }, 20_000);
  it("fetches the Spanish swsh3-20 and maps its localized category and type", async () => {
    const printing = await createTcgdexProvider().getPrinting("tcgdex:es:swsh3-20", "es");
    expect(cardPrintingSchema.parse(printing)).toMatchObject({
      id: "tcgdex:es:swsh3-20",
      language: "es",
      category: "pokemon",
      energyTypes: ["fire"],
    });
  }, 20_000);
});

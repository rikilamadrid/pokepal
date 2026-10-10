import { describe, expect, it } from "vitest";
import { createTcgdexProvider } from "@/lib/catalog/tcgdex";
import type { CatalogProvider } from "@/lib/catalog/provider";
import {
  MAX_MATCHES,
  nameSimilarity,
  normalizeCollectorNumber,
  rankPrintings,
  resolve,
  type ResolveResult,
} from "@/lib/recognition/resolve";
import type { CardPrinting } from "@/types/catalog";
import type { ExtractedCardFields } from "@/types/scan";
import { printingMatchSchema } from "@/types/scan.schema";
import { createFixtureFetch } from "../helpers/tcgdex-fixtures";
import { createMemoryCatalog, recordedPrinting, recordedPrintings } from "../helpers/memory-catalog";

const now = () => new Date("2026-10-09T12:00:00.000Z");

function read(fields: Partial<ExtractedCardFields>): ExtractedCardFields {
  return {
    name: null,
    collectorNumber: null,
    setOfficialCount: null,
    setCodeHint: null,
    hp: null,
    language: null,
    regulationMark: null,
    finishHint: null,
    bbox: null,
    modelConfidence: 0.9,
    ...fields,
  };
}

/** The real TCGdex adapter over recorded responses; records every requested path. */
function tcgdex(requested: string[] = []): CatalogProvider {
  return createTcgdexProvider({ fetchJson: createFixtureFetch(requested), now });
}

/** Wrap a catalog so every printing it returns is remembered by identity. */
function tracking(catalog: CatalogProvider) {
  const returned = new Set<CardPrinting>();
  const keep = (ps: CardPrinting[]) => (ps.forEach((p) => returned.add(p)), ps);
  const wrapped: CatalogProvider = {
    getPrinting: async (id, lang) => {
      const p = await catalog.getPrinting(id, lang);
      if (p) returned.add(p);
      return p;
    },
    findByNumber: async (...a) => keep(await catalog.findByNumber(...a)),
    searchByName: async (...a) => keep(await catalog.searchByName(...a)),
  };
  return { catalog: wrapped, returned };
}

/** Resolve and assert the result never contains a printing the catalog did not return. */
async function resolveChecked(extracted: ExtractedCardFields, catalog: CatalogProvider) {
  const t = tracking(catalog);
  const result = await resolve(extracted, t.catalog);
  for (const m of result.matches) {
    expect(t.returned.has(m.printing)).toBe(true);
    expect(printingMatchSchema.safeParse(m).success).toBe(true);
  }
  expect(result.matches.length).toBeLessThanOrEqual(MAX_MATCHES);
  if (result.tier === "unmatched") expect(result.matches).toEqual([]);
  return result;
}

const ids = (r: ResolveResult) => r.matches.map((m) => m.printing.id);

describe("normalization", () => {
  it("compares printed numbers without zero padding or case", () => {
    expect(normalizeCollectorNumber("020")).toBe("20");
    expect(normalizeCollectorNumber(" swsh261 ")).toBe("SWSH261");
    expect(normalizeCollectorNumber("TG05")).toBe("TG05");
  });

  it("scores names ignoring case, accents, and punctuation", () => {
    expect(nameSimilarity("charizard vmax", "Charizard VMAX")).toBe(1);
    expect(nameSimilarity("Pokemon", "Pokémon")).toBe(1);
    expect(nameSimilarity("Professors Research", "Professor's Research")).toBe(1);
    expect(nameSimilarity("Pikachu", "Charizard VMAX")).toBeLessThan(0.5);
    expect(nameSimilarity("", "Charizard")).toBe(0);
    expect(nameSimilarity("Professor's Research", "Professor's Research (Professor Magnolia)")).toBe(1);
  });
});

describe("resolve — exact", () => {
  it("resolves number + official count + name to the one printing (recorded TCGdex)", async () => {
    const requested: string[] = [];
    const r = await resolveChecked(
      read({ name: "Charizard VMAX", collectorNumber: "020", setOfficialCount: 189, hp: 330, regulationMark: "D", language: "en" }),
      tcgdex(requested),
    );
    expect(r.tier).toBe("exact");
    expect(r.matches[0].printing.id).toBe("tcgdex:en:swsh3-20");
    expect(r.matches[0].reasons).toEqual(["number", "denominator", "name=", "hp", "regulation", "language"]);
    expect(r.matches[0].score).toBe(1);
    // The other "20/189" printing stays in the list, ranked below.
    expect(ids(r)).toEqual(["tcgdex:en:swsh3-20", "tcgdex:en:swsh10-020"]);
    // Number lookup first; the name agreed, so no name search ran.
    expect(requested.some((p) => p.startsWith("/en/cards?"))).toBe(false);
  });

  it("looks up English when the language was not read, but caps the tier at ambiguous", async () => {
    // The es printing has the same name; an unread language cannot prove the en one.
    const calls: string[] = [];
    const r = await resolveChecked(
      read({ name: "Charizard VMAX", collectorNumber: "20", setOfficialCount: 189, hp: 330, regulationMark: "D" }),
      createMemoryCatalog(undefined, calls),
    );
    expect(calls[0]).toBe("number en 20/189");
    expect(r.tier).toBe("ambiguous");
    // The identity candidate still ranks first, without language weight.
    expect(r.matches[0].printing.id).toBe("tcgdex:en:swsh3-20");
    expect(r.matches[0].reasons).not.toContain("language");
  });
});

describe("resolve — similar names at one number/denominator", () => {
  // Two printings at 006/165 whose names differ only by a suffix, with different HP.
  const base = recordedPrinting("en", "swsh3-20");
  const at006 = (id: string, name: string, hp: number): CardPrinting => ({
    ...base,
    id: `tcgdex:en:${id}`,
    providerCardId: id,
    name,
    collectorNumber: "006",
    hp,
    regulationMark: null,
    set: { ...base.set, id: id.split("-")[0], officialCount: 165 },
  });
  const plain = at006("ecard1-6", "Charizard", 120);
  const ex = at006("sv03.5-006", "Charizard ex", 330);
  const both = [plain, ex];

  it("both names agree (similarity >= 0.8), so a name alone cannot separate them", () => {
    expect(nameSimilarity("Charizard", "Charizard ex")).toBeGreaterThanOrEqual(0.8);
    const r = rankPrintings(read({ name: "Charizard ex", collectorNumber: "006", setOfficialCount: 165, language: "en" }), both);
    expect(r.tier).toBe("ambiguous");
    expect(r.matches[0].printing.id).toBe(ex.id);
  });

  it("a full read of the ex card is exact: the other printing's HP contradicts it", () => {
    const r = rankPrintings(
      read({ name: "Charizard ex", collectorNumber: "006", setOfficialCount: 165, hp: 330, language: "en" }),
      both,
    );
    expect(r.tier).toBe("exact");
    expect(ids(r)).toEqual([ex.id, plain.id]);
    expect(r.matches[1].reasons).toContain("hp≠");
  });

  it("a full read of the base card is exact the other way", () => {
    const r = rankPrintings(
      read({ name: "Charizard", collectorNumber: "6", setOfficialCount: 165, hp: 120, language: "en" }),
      both,
    );
    expect(r.tier).toBe("exact");
    expect(ids(r)).toEqual([plain.id, ex.id]);
  });

  it("a dropped suffix is not trusted: 'Charizard' with HP 330 resolves to the ex card", () => {
    const r = rankPrintings(
      read({ name: "Charizard", collectorNumber: "006", setOfficialCount: 165, hp: 330, language: "en" }),
      both,
    );
    expect(r.tier).toBe("exact");
    expect(r.matches[0].printing.id).toBe(ex.id);
  });

  it("a contradicting HP removes identity even for a lone candidate", () => {
    const r = rankPrintings(
      read({ name: "Charizard ex", collectorNumber: "006", setOfficialCount: 165, hp: 120, language: "en" }),
      [ex],
    );
    expect(r.tier).toBe("ambiguous");
    expect(r.matches[0].reasons).toContain("hp≠");
  });

  it("a contradicting regulation mark removes identity", () => {
    const r = rankPrintings(
      read({ name: "Charizard VMAX", collectorNumber: "20", setOfficialCount: 189, regulationMark: "F", language: "en" }),
      [base],
    );
    expect(r.tier).toBe("ambiguous");
    expect(r.matches[0].reasons).toContain("regulation≠");
  });
});

describe("resolve — ambiguous (same number, different sets)", () => {
  it("returns both 20/189 printings when the name was not read", async () => {
    const r = await resolveChecked(
      read({ collectorNumber: "20", setOfficialCount: 189, language: "en" }),
      tcgdex(),
    );
    expect(r.tier).toBe("ambiguous");
    expect(ids(r).sort()).toEqual(["tcgdex:en:swsh10-020", "tcgdex:en:swsh3-20"]);
    for (const m of r.matches) expect(m.reasons).toEqual(expect.arrayContaining(["number", "denominator"]));
  });

  it("is ambiguous when two candidates both have identity evidence", () => {
    const a = recordedPrinting("en", "swsh3-20");
    const twin: CardPrinting = { ...a, id: "tcgdex:en:swsh3x-20", providerCardId: "swsh3x-20", set: { ...a.set, id: "swsh3x" } };
    const r = rankPrintings(read({ name: "Charizard VMAX", collectorNumber: "20", setOfficialCount: 189, language: "en" }), [a, twin]);
    expect(r.tier).toBe("ambiguous");
    expect(r.matches).toHaveLength(2);
  });
});

describe("resolve — unmatched", () => {
  it("returns no printing when nothing agrees on number or name", async () => {
    const calls: string[] = [];
    const r = await resolveChecked(
      read({ name: "Missingno", collectorNumber: "999", setOfficialCount: 999, language: "en" }),
      createMemoryCatalog(undefined, calls),
    );
    expect(r).toEqual({ tier: "unmatched", matches: [] });
    expect(calls).toEqual(["number en 999/999", "name en Missingno"]);
  });

  it("returns no printing when the model read nothing usable", async () => {
    const calls: string[] = [];
    const r = await resolveChecked(read({ modelConfidence: 0 }), createMemoryCatalog(undefined, calls));
    expect(r).toEqual({ tier: "unmatched", matches: [] });
    expect(calls).toEqual([]);
  });

  it("drops weak name hits that share neither number nor a close name", () => {
    const r = rankPrintings(read({ name: "Pikachu" }), recordedPrintings());
    expect(r).toEqual({ tier: "unmatched", matches: [] });
  });
});

describe("resolve — secret rare (number above the official count)", () => {
  it("resolves 074/073 to Champion's Path Charizard VMAX", async () => {
    const r = await resolveChecked(
      read({ name: "Charizard VMAX", collectorNumber: "074", setOfficialCount: 73, language: "en" }),
      createMemoryCatalog(),
    );
    expect(r.tier).toBe("exact");
    expect(r.matches[0].printing.id).toBe("tcgdex:en:swsh3.5-74");
    expect(r.matches[0].reasons).toContain("secret-rare");
  });

  it("resolves a Shiny Vault SV107/SV122 number", async () => {
    const r = await resolveChecked(
      read({ name: "Charizard VMAX", collectorNumber: "SV107", setOfficialCount: 122, language: "en" }),
      createMemoryCatalog(),
    );
    expect(r.tier).toBe("exact");
    expect(r.matches[0].printing.id).toBe("tcgdex:en:swsh4.5sv-SV107");
  });
});

describe("resolve — promo codes (no set denominator)", () => {
  it("resolves SWSH261 via name search plus the printed promo number (recorded TCGdex)", async () => {
    const requested: string[] = [];
    const r = await resolveChecked(
      read({ name: "Charizard VMAX", collectorNumber: "swsh261", language: "en" }),
      tcgdex(requested),
    );
    expect(requested[0]).toBe("/en/cards?name=Charizard+VMAX");
    expect(r.tier).toBe("exact");
    expect(r.matches[0].printing.id).toBe("tcgdex:en:swshp-SWSH261");
    expect(r.matches[0].reasons).toEqual(["number", "name=", "language"]);
    // Every other Charizard VMAX printing is a lower-ranked alternative.
    expect(r.matches.slice(1).every((m) => !m.reasons.includes("number"))).toBe(true);
  });

  it("stays ambiguous on a name alone, without a number", async () => {
    const r = await resolveChecked(read({ name: "Charizard VMAX", language: "en" }), tcgdex());
    expect(r.tier).toBe("ambiguous");
    expect(r.matches).toHaveLength(4);
  });
});

describe("resolve — non-English cards", () => {
  it("resolves a Japanese card to its ja printing", async () => {
    const calls: string[] = [];
    const r = await resolveChecked(
      read({ name: "リザードンex", collectorNumber: "006", setOfficialCount: 165, hp: 330, regulationMark: "G", language: "ja" }),
      createMemoryCatalog(undefined, calls),
    );
    expect(calls[0]).toBe("number ja 006/165");
    expect(r.tier).toBe("exact");
    expect(r.matches[0].printing.id).toBe("tcgdex:ja:SV2a-006");
    expect(r.matches[0].reasons).toEqual(["number", "denominator", "name=", "hp", "regulation", "language"]);
  });

  it("resolves a Spanish card to the es printing, never the en one", async () => {
    const r = await resolveChecked(
      read({ name: "Charizard VMAX", collectorNumber: "20", setOfficialCount: 189, language: "es" }),
      createMemoryCatalog(),
    );
    expect(r.tier).toBe("exact");
    expect(ids(r)).toEqual(["tcgdex:es:swsh3-20"]);
  });
});

describe("resolve — wrong name, right number", () => {
  it("lowers the tier from exact to ambiguous and keeps both readings", async () => {
    const extracted = read({ collectorNumber: "178", setOfficialCount: 202, language: "en" });

    const right = await resolveChecked({ ...extracted, name: "Professor's Research" }, createMemoryCatalog());
    expect(right.tier).toBe("exact");
    expect(right.matches[0].printing.id).toBe("tcgdex:en:swsh1-178");

    const calls: string[] = [];
    const wrong = await resolveChecked({ ...extracted, name: "Charizard" }, createMemoryCatalog(undefined, calls));
    expect(calls).toEqual(["number en 178/202", "name en Charizard"]);
    expect(wrong.tier).toBe("ambiguous");
    const professor = wrong.matches.find((m) => m.printing.id === "tcgdex:en:swsh1-178");
    expect(professor?.reasons).toEqual(["number", "denominator", "name≠", "language"]);
    expect(professor!.score).toBeLessThan(right.matches[0].score);
    expect(ids(wrong)).toContain("tcgdex:en:30th-c-001");
  });

  it("does not let a near name override a conflicting set denominator", () => {
    const r = rankPrintings(
      read({ name: "Charizard VMAX", collectorNumber: "20", setOfficialCount: 73, language: "en" }),
      [recordedPrinting("en", "swsh3-20")],
    );
    expect(r.tier).toBe("ambiguous");
  });
});

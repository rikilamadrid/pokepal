import { describe, expect, expectTypeOf, it } from "vitest";
import type { z } from "zod";
import { cardPrintingSchema, pokemonSpeciesSchema } from "@/types/catalog.schema";
import { ownedCardSchema, ownershipSummarySchema } from "@/types/collection.schema";
import { extractedCardFieldsSchema, scanBatchSchema } from "@/types/scan.schema";
import type { CardPrinting, PokemonSpecies } from "@/types/catalog";
import type { OwnedCard, OwnershipSummary } from "@/types/collection";
import type { ExtractedCardFields, ScanBatch } from "@/types/scan";
import { mapTcgdexCard } from "@/lib/catalog/tcgdex";
import { loadFixture } from "../helpers/tcgdex-fixtures";

const printing = mapTcgdexCard(loadFixture("/en/cards/swsh3-20"), "en", "2026-10-09T12:00:00.000Z");

const owned: OwnedCard = {
  id: "8f14e45f-ceea-4e7a-9f6b-1d2c3b4a5e6f",
  ownerId: "",
  printingId: printing.id,
  finish: "holo",
  favorite: false,
  source: "scan",
  acquiredAt: "2026-10-09T12:00:00.000Z",
  storageLocationId: null,
  updatedAt: "2026-10-09T12:00:00.000Z",
};

const extracted: ExtractedCardFields = {
  name: "Charizard VMAX",
  collectorNumber: "20",
  setOfficialCount: 189,
  setCodeHint: null,
  hp: 330,
  language: "en",
  regulationMark: "D",
  finishHint: "holo",
  bbox: { x: 0.1, y: 0.1, w: 0.4, h: 0.6 },
  modelConfidence: 0.9,
};

describe("contract schemas", () => {
  it("infer exactly the contract types", () => {
    expectTypeOf<z.infer<typeof cardPrintingSchema>>().toEqualTypeOf<CardPrinting>();
    expectTypeOf<z.infer<typeof pokemonSpeciesSchema>>().toEqualTypeOf<PokemonSpecies>();
    expectTypeOf<z.infer<typeof ownedCardSchema>>().toEqualTypeOf<OwnedCard>();
    expectTypeOf<z.infer<typeof ownershipSummarySchema>>().toEqualTypeOf<OwnershipSummary>();
    expectTypeOf<z.infer<typeof extractedCardFieldsSchema>>().toEqualTypeOf<ExtractedCardFields>();
    expectTypeOf<z.infer<typeof scanBatchSchema>>().toEqualTypeOf<ScanBatch>();
  });

  it("CardPrinting rejects extra keys such as pricing", () => {
    expect(cardPrintingSchema.safeParse(printing).success).toBe(true);
    expect(cardPrintingSchema.safeParse({ ...printing, pricing: {} }).success).toBe(false);
  });

  it("CardPrinting id must be {provider}:{language}:{providerCardId}", () => {
    expect(printing.id).toBe("tcgdex:en:swsh3-20");
    expect(cardPrintingSchema.safeParse({ ...printing, id: "tcgdex:swsh3-20" }).success).toBe(false);
    expect(cardPrintingSchema.safeParse({ ...printing, id: "tcgdex:es:swsh3-20" }).success).toBe(false);
    expect(cardPrintingSchema.safeParse({ ...printing, language: "fr" }).success).toBe(false);
  });

  it("OwnedCard requires a UUID id and ISO timestamps", () => {
    expect(ownedCardSchema.safeParse(owned).success).toBe(true);
    expect(ownedCardSchema.safeParse({ ...owned, id: "card-1728475200000" }).success).toBe(false);
    expect(ownedCardSchema.safeParse({ ...owned, acquiredAt: "yesterday" }).success).toBe(false);
    expect(
      ownedCardSchema.safeParse({ ...owned, updatedAt: "2026-10-09T12:00:00+00:00" }).success,
    ).toBe(true);
  });

  it("OwnershipSummary accepts partial finish counts", () => {
    expect(
      ownershipSummarySchema.safeParse({ printingId: printing.id, copies: 2, finishes: { holo: 2 } })
        .success,
    ).toBe(true);
  });

  it("ScanBatch validates nested candidates and bounds scores to 0..1", () => {
    const batch: ScanBatch = {
      id: "batch-1",
      mode: "batch",
      createdAt: "2026-10-09T12:00:00.000Z",
      candidates: [
        {
          id: "c1",
          extracted,
          tier: "exact",
          matches: [{ printing, score: 0.97, reasons: ["number+total", "name≈"] }],
          chosenPrintingId: null,
          status: "pending",
          ownedCopies: 0,
        },
      ],
      timings: { uploadMs: 100, modelMs: 2000, resolveMs: 50, totalMs: 2150 },
    };
    expect(scanBatchSchema.safeParse(batch).success).toBe(true);
    expect(extractedCardFieldsSchema.safeParse({ ...extracted, modelConfidence: 1.2 }).success).toBe(
      false,
    );
  });
});

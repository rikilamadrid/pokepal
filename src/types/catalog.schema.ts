import { z } from "zod";
import type {
  CardCategory,
  CardFinish,
  CardPrinting,
  CardSetRef,
  CatalogLanguage,
  EnergyType,
  PokedexRegion,
  PokemonSpecies,
} from "@/types/catalog";

/** Zod schemas for the catalog contract in `catalog.ts`. */

const isoDateTime = z.iso.datetime({ offset: true });

export const ENERGY_TYPES = [
  "grass",
  "fire",
  "water",
  "lightning",
  "psychic",
  "fighting",
  "darkness",
  "metal",
  "fairy",
  "dragon",
  "colorless",
] as const satisfies readonly EnergyType[];

export const CARD_CATEGORIES = [
  "pokemon",
  "trainer",
  "energy",
] as const satisfies readonly CardCategory[];

export const CARD_FINISHES = [
  "normal",
  "holo",
  "reverse",
  "firstEdition",
] as const satisfies readonly CardFinish[];

export const CATALOG_LANGUAGES = [
  "en",
  "es",
  "ja",
] as const satisfies readonly CatalogLanguage[];

export const POKEDEX_REGIONS = [
  "kanto",
  "johto",
  "hoenn",
  "sinnoh",
  "unova",
  "kalos",
  "alola",
  "galar",
  "hisui",
  "paldea",
] as const satisfies readonly PokedexRegion[];

export const energyTypeSchema: z.ZodType<EnergyType> = z.enum(ENERGY_TYPES);
export const cardCategorySchema: z.ZodType<CardCategory> =
  z.enum(CARD_CATEGORIES);
export const cardFinishSchema: z.ZodType<CardFinish> = z.enum(CARD_FINISHES);
export const catalogLanguageSchema: z.ZodType<CatalogLanguage> =
  z.enum(CATALOG_LANGUAGES);
export const pokedexRegionSchema: z.ZodType<PokedexRegion> =
  z.enum(POKEDEX_REGIONS);

export const pokemonSpeciesSchema: z.ZodType<PokemonSpecies> = z.strictObject({
  dexNo: z.number().int().positive(),
  name: z.string().min(1),
  region: pokedexRegionSchema,
});

export const cardSetRefSchema: z.ZodType<CardSetRef> = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1),
  officialCount: z.number().int().nonnegative(),
  totalCount: z.number().int().nonnegative(),
  releaseDate: z.string().nullable(),
  symbolUrl: z.url().nullable(),
  logoUrl: z.url().nullable(),
});

/**
 * Strict: a printing carries exactly the contract's keys, so provider extras
 * (pricing, attacks, legality, …) can never leak past the adapter boundary.
 */
export const cardPrintingSchema: z.ZodType<CardPrinting> = z
  .strictObject({
    id: z.string().min(1),
    provider: z.literal("tcgdex"),
    providerCardId: z.string().min(1),
    language: catalogLanguageSchema,
    name: z.string().min(1),
    category: cardCategorySchema,
    collectorNumber: z.string().min(1),
    set: cardSetRefSchema,
    rarity: z.string().nullable(),
    energyTypes: z.array(energyTypeSchema),
    stage: z.string().nullable(),
    hp: z.number().int().positive().nullable(),
    dexNos: z.array(z.number().int().positive()),
    illustrator: z.string().nullable(),
    regulationMark: z.string().nullable(),
    availableFinishes: z.array(cardFinishSchema),
    imageUrl: z.url().nullable(),
    fetchedAt: isoDateTime,
  })
  .refine((p) => p.id === `${p.provider}:${p.language}:${p.providerCardId}`, {
    message: "id must be {provider}:{language}:{providerCardId}",
    path: ["id"],
  });

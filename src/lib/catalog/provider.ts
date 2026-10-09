import type { CardPrinting, CatalogLanguage } from "@/types/catalog";

/**
 * The one seam between PokéPal and a card catalog. Every result is a
 * Zod-validated `CardPrinting` with provider extras (pricing, …) dropped.
 */
export interface CatalogProvider {
  /** One printing by id (`"tcgdex:swsh3-20"` or `"swsh3-20"`); null if unknown. */
  getPrinting(id: string, lang: CatalogLanguage): Promise<CardPrinting | null>;
  /** Printings whose printed number is `collectorNumber` in a set of `setOfficialCount` cards. */
  findByNumber(
    collectorNumber: string,
    setOfficialCount: number,
    lang: CatalogLanguage,
  ): Promise<CardPrinting[]>;
  /** Printings whose name contains `name` (case-insensitive), capped. */
  searchByName(name: string, lang: CatalogLanguage): Promise<CardPrinting[]>;
}

/**
 * Transport: GET a provider path (e.g. `"/en/cards/swsh3-20"`) and return the
 * parsed JSON, or `null` when the resource does not exist (HTTP 404).
 * Injected so tests run offline against recorded responses.
 */
export type CatalogFetch = (path: string) => Promise<unknown>;

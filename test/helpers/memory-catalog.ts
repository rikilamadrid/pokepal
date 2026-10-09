import { collectorNumberVariants, mapTcgdexCard } from "@/lib/catalog/tcgdex";
import type { CatalogProvider } from "@/lib/catalog/provider";
import type { CardPrinting, CatalogLanguage } from "@/types/catalog";
import { loadFixture } from "./tcgdex-fixtures";

const FETCHED_AT = "2026-10-09T12:00:00.000Z";

/** A printing mapped by the real adapter from a recorded TCGdex card response. */
export function recordedPrinting(lang: CatalogLanguage, cardId: string): CardPrinting {
  return mapTcgdexCard(loadFixture(`/${lang}/cards/${cardId}`), lang, FETCHED_AT);
}

/** Every recorded TCGdex card, mapped by the real adapter. */
export function recordedPrintings(): CardPrinting[] {
  return [
    recordedPrinting("en", "swsh3-20"),
    recordedPrinting("en", "swsh3.5-74"),
    recordedPrinting("en", "swshp-SWSH261"),
    recordedPrinting("en", "swsh4.5sv-SV107"),
    recordedPrinting("en", "30th-c-001"),
    recordedPrinting("en", "swsh1-178"),
    recordedPrinting("en", "hgss1-116"),
    mapTcgdexCard(loadFixture("/en/sets/swsh10/20"), "en", FETCHED_AT),
    recordedPrinting("es", "swsh3-20"),
    recordedPrinting("es", "swsh1-178"),
    recordedPrinting("ja", "SV2a-006"),
  ];
}

/**
 * In-memory `CatalogProvider` over recorded printings, with the same lookup
 * semantics as the TCGdex adapter. `calls` records every lookup.
 */
export function createMemoryCatalog(
  printings: readonly CardPrinting[] = recordedPrintings(),
  calls: string[] = [],
): CatalogProvider {
  const inLang = (lang: CatalogLanguage) => printings.filter((p) => p.language === lang);
  return {
    async getPrinting(id, lang) {
      calls.push(`get ${lang} ${id}`);
      return inLang(lang).find((p) => p.id === id || p.providerCardId === id) ?? null;
    },
    async findByNumber(collectorNumber, setOfficialCount, lang) {
      calls.push(`number ${lang} ${collectorNumber}/${setOfficialCount}`);
      const numbers = collectorNumberVariants(collectorNumber);
      return inLang(lang).filter(
        (p) => p.set.officialCount === setOfficialCount && numbers.includes(p.collectorNumber),
      );
    },
    async searchByName(name, lang) {
      calls.push(`name ${lang} ${name}`);
      const needle = name.trim().toLowerCase();
      return needle ? inLang(lang).filter((p) => p.name.toLowerCase().includes(needle)) : [];
    },
  };
}

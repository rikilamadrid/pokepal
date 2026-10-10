import type { CatalogProvider } from "@/lib/catalog/provider";
import { collectorNumberVariants } from "@/lib/catalog/tcgdex";
import { createFixtureTransport, type RecognitionTransport } from "@/lib/recognition";
import type { ExtractedCardFields } from "@/types/scan";
import { DEV_PRINTINGS } from "@/data/dev-owned-seed";

/**
 * DEV ONLY — loaded by `getScanTransport` through a dynamic import that runs
 * only when `NODE_ENV === "development"` and the URL has `?scan-fixture`, so
 * Batch Scan can be exercised on a phone before the Edge Function (19.2)
 * exists. Never imported by production code; makes no network or model call.
 *
 * Hand-written stand-in for one 6-card photo's model output (not a real model
 * response). Against the dev printings it resolves to: exact, exact (es),
 * ambiguous (name only), exact (trainer), unmatched, exact (ja).
 */
export const DEV_SCAN_EXTRACTIONS: readonly ExtractedCardFields[] = [
  read({ name: "Charizard VMAX", collectorNumber: "020", setOfficialCount: 189, hp: 330, language: "en", regulationMark: "D", finishHint: "holo" }),
  read({ name: "Charizard VMAX", collectorNumber: "20", setOfficialCount: 189, hp: 330, language: "es", regulationMark: "D" }),
  read({ name: "Charizard VMAX", language: "en", modelConfidence: 0.45 }),
  read({ name: "Professor's Research", collectorNumber: "178", setOfficialCount: 202, language: "en", regulationMark: "D" }),
  read({ name: "Missingno", collectorNumber: "999", setOfficialCount: 999, language: "en", modelConfidence: 0.2 }),
  read({ name: "リザードンex", collectorNumber: "006", setOfficialCount: 165, hp: 330, language: "ja", regulationMark: "G" }),
];

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

/** In-memory catalog over the dev printings, with the TCGdex adapter's lookup semantics. */
function devCatalog(): CatalogProvider {
  const inLang = (lang: string) => DEV_PRINTINGS.filter((p) => p.language === lang);
  return {
    async getPrinting(id, lang) {
      return inLang(lang).find((p) => p.id === id || p.providerCardId === id) ?? null;
    },
    async findByNumber(collectorNumber, setOfficialCount, lang) {
      const numbers = collectorNumberVariants(collectorNumber);
      return inLang(lang).filter(
        (p) => p.set.officialCount === setOfficialCount && numbers.includes(p.collectorNumber),
      );
    },
    async searchByName(name, lang) {
      const needle = name.trim().toLowerCase();
      return needle ? inLang(lang).filter((p) => p.name.toLowerCase().includes(needle)) : [];
    },
  };
}

/** Fixture transport replaying the 6-card dev photo, with a short fake model delay. */
export function createDevScanTransport(): RecognitionTransport {
  const inner = createFixtureTransport({ extractions: DEV_SCAN_EXTRACTIONS, catalog: devCatalog(), modelMs: 900 });
  return {
    async recognize(request) {
      await new Promise((resolve) => setTimeout(resolve, 900));
      return inner.recognize(request);
    },
  };
}

import type { CatalogProvider } from "@/lib/catalog/provider";
import type { CardPrinting, CatalogLanguage } from "@/types/catalog";
import type { ExtractedCardFields, MatchTier, PrintingMatch } from "@/types/scan";

/**
 * Printing resolver: what a vision model read off a card → an exact catalog
 * printing, a ranked shortlist, or unmatched. Shared by the client fixture
 * transport, tests, and (ticket 19.2) the Edge Function, so it imports only
 * types and takes the catalog as a parameter.
 *
 * Candidates: catalog lookup by (collectorNumber, setOfficialCount) first; then
 * a name search when no number was read, the number lookup found nothing, or no
 * number candidate agrees with the read name.
 *
 * Score (0..1, sum of earned weights; a field the model did not read earns 0):
 *   number 0.35 · set denominator 0.15 · name similarity 0.30 (scaled)
 *   · HP 0.08 · regulation mark 0.07 · language read off the card 0.05
 *
 * Identity evidence: same printed number, a name that agrees (similarity
 * ≥ 0.8), the set denominator when one was read, and no read field that
 * contradicts the printing (a read HP or regulation mark that differs).
 *
 * Tiers:
 *   exact     — the language was read off the card and exactly one candidate
 *               has identity evidence.
 *   ambiguous — candidates exist but none (or more than one) has identity
 *               evidence, or the language was not read (lookup then defaults
 *               to English, which cannot prove a language-qualified printing);
 *               ranked, capped at MAX_MATCHES.
 *   unmatched — no candidate agrees on number or name; matches is [].
 *
 * Two printings at one number/denominator whose names differ only by a suffix
 * ("Charizard" vs "Charizard ex") both agree on name; a read HP or regulation
 * mark separates them. Without one the read stays ambiguous: an exact-name
 * match alone does not break the tie, because a dropped suffix is a plausible
 * misread.
 *
 * Every match is a printing the catalog returned; the resolver never builds one.
 */

export const WEIGHTS = {
  number: 0.35,
  denominator: 0.15,
  name: 0.3,
  hp: 0.08,
  regulationMark: 0.07,
  language: 0.05,
} as const;

/** Name similarity at or above which the read name agrees with a printing. */
export const NAME_AGREES = 0.8;
/** Below this, and without a number agreement, a candidate is dropped. */
export const NAME_RELEVANT = 0.5;
export const MAX_MATCHES = 5;
export const DEFAULT_LANGUAGE: CatalogLanguage = "en";

export interface ResolveResult {
  tier: MatchTier;
  matches: PrintingMatch[];
}

/** Printed number in comparable form: trimmed, upper-cased, numeric zeros dropped. */
export function normalizeCollectorNumber(value: string): string {
  const trimmed = value.trim().toUpperCase();
  return /^\d+$/.test(trimmed) ? String(Number(trimmed)) : trimmed;
}

/** Name in comparable form: NFKC, lower-cased, accents and punctuation dropped. */
export function normalizeName(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function levenshtein(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = above;
    }
  }
  return prev[b.length];
}

function editSimilarity(a: string, b: string): number {
  const x = normalizeName(a);
  const y = normalizeName(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  return 1 - levenshtein(x, y) / Math.max(x.length, y.length);
}

/**
 * 0..1 edit-distance similarity of a read name and a catalog name, after
 * normalization. A trailing catalog qualifier the card does not print as its
 * title — "Professor's Research (Professor Magnolia)" — may be ignored.
 */
export function nameSimilarity(read: string, catalogName: string): number {
  const title = catalogName.replace(/\s*\([^()]*\)\s*$/, "");
  return Math.max(editSimilarity(read, catalogName), title ? editSimilarity(read, title) : 0);
}

interface Scored extends PrintingMatch {
  identity: boolean;
  numberAgrees: boolean;
  nameScore: number | null;
}

function scorePrinting(extracted: ExtractedCardFields, printing: CardPrinting): Scored {
  const reasons: string[] = [];
  let score = 0;

  const numberAgrees =
    extracted.collectorNumber !== null &&
    normalizeCollectorNumber(extracted.collectorNumber) ===
      normalizeCollectorNumber(printing.collectorNumber);
  if (numberAgrees) {
    score += WEIGHTS.number;
    reasons.push("number");
  }

  const count = extracted.setOfficialCount;
  const denominatorAgrees = count !== null && printing.set.officialCount === count;
  if (denominatorAgrees) {
    score += WEIGHTS.denominator;
    reasons.push("denominator");
    const n = Number(normalizeCollectorNumber(printing.collectorNumber));
    if (numberAgrees && Number.isInteger(n) && n > count) reasons.push("secret-rare");
  }

  const nameScore = extracted.name === null ? null : nameSimilarity(extracted.name, printing.name);
  if (nameScore !== null) {
    score += WEIGHTS.name * nameScore;
    reasons.push(nameScore === 1 ? "name=" : nameScore >= NAME_AGREES ? "name≈" : "name≠");
  }

  let contradicted = false;
  if (extracted.hp !== null && printing.hp !== null) {
    const same = extracted.hp === printing.hp;
    if (same) score += WEIGHTS.hp;
    else contradicted = true;
    reasons.push(same ? "hp" : "hp≠");
  }

  if (extracted.regulationMark !== null && printing.regulationMark !== null) {
    const same =
      extracted.regulationMark.trim().toUpperCase() === printing.regulationMark.trim().toUpperCase();
    if (same) score += WEIGHTS.regulationMark;
    else contradicted = true;
    reasons.push(same ? "regulation" : "regulation≠");
  }

  if (extracted.language !== null && extracted.language === printing.language) {
    score += WEIGHTS.language;
    reasons.push("language");
  }

  const identity =
    numberAgrees &&
    nameScore !== null &&
    nameScore >= NAME_AGREES &&
    (count === null || denominatorAgrees) &&
    !contradicted;

  return {
    printing,
    score: Math.min(1, Math.round(score * 1000) / 1000),
    reasons,
    identity,
    numberAgrees,
    nameScore,
  };
}

/**
 * Pure ranking of catalog candidates against what the model read. Exposed so
 * callers holding candidates already (Edge Function, evals) skip the lookups.
 */
export function rankPrintings(
  extracted: ExtractedCardFields,
  candidates: readonly CardPrinting[],
): ResolveResult {
  const unique = new Map(candidates.map((p) => [p.id, p]));
  const scored = [...unique.values()]
    .map((p) => scorePrinting(extracted, p))
    .filter((s) => s.numberAgrees || (s.nameScore !== null && s.nameScore >= NAME_RELEVANT))
    .sort((a, b) => b.score - a.score || a.printing.id.localeCompare(b.printing.id));

  if (scored.length === 0) return { tier: "unmatched", matches: [] };

  const identities = scored.filter((s) => s.identity);
  const tier: MatchTier =
    identities.length === 1 && extracted.language !== null ? "exact" : "ambiguous";
  const ranked =
    identities.length === 1 ? [identities[0], ...scored.filter((s) => !s.identity)] : scored;

  return {
    tier,
    matches: ranked
      .slice(0, MAX_MATCHES)
      .map(({ printing, score, reasons }) => ({ printing, score, reasons })),
  };
}

/** Resolve one card's extracted fields against the catalog. */
export async function resolve(
  extracted: ExtractedCardFields,
  catalog: CatalogProvider,
): Promise<ResolveResult> {
  const lang = extracted.language ?? DEFAULT_LANGUAGE;
  const number = extracted.collectorNumber?.trim() || null;
  const name = extracted.name?.trim() || null;

  const byNumber =
    number !== null && extracted.setOfficialCount !== null
      ? await catalog.findByNumber(number, extracted.setOfficialCount, lang)
      : [];

  const numberNameAgrees =
    name !== null && byNumber.some((p) => nameSimilarity(name, p.name) >= NAME_AGREES);
  const byName =
    name !== null && !numberNameAgrees ? await catalog.searchByName(name, lang) : [];

  return rankPrintings(extracted, [...byNumber, ...byName]);
}

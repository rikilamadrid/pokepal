import { z } from "zod";
import { CATALOG_LANGUAGES, cardPrintingSchema } from "@/types/catalog.schema";
import type {
  CardCategory,
  CardFinish,
  CardPrinting,
  CatalogLanguage,
  EnergyType,
} from "@/types/catalog";
import type { CatalogFetch, CatalogProvider } from "@/lib/catalog/provider";

export const TCGDEX_BASE_URL = "https://api.tcgdex.net/v2";
const ID_PREFIX = "tcgdex:";
const DEFAULT_MAX_SEARCH_RESULTS = 20;

/** A catalog response that is missing, malformed, or failed to load. */
export class CatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogError";
  }
}

// ---- Raw TCGdex shapes (only the fields PokéPal reads; the rest is ignored) --

const rawSetBriefSchema = z.looseObject({
  id: z.string().min(1),
  name: z.string().min(1),
  logo: z.string().optional(),
  symbol: z.string().optional(),
  releaseDate: z.string().optional(),
  cardCount: z.looseObject({
    official: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  }),
});

const rawCardSchema = z.looseObject({
  id: z.string().min(1),
  localId: z.union([z.string(), z.number()]).transform(String),
  name: z.string().min(1),
  category: z.string(),
  image: z.string().optional(),
  illustrator: z.string().optional(),
  rarity: z.string().optional(),
  set: rawSetBriefSchema,
  variants: z
    .looseObject({
      normal: z.boolean().optional(),
      reverse: z.boolean().optional(),
      holo: z.boolean().optional(),
      firstEdition: z.boolean().optional(),
    })
    .optional(),
  dexId: z.array(z.number().int().positive()).optional(),
  // TCGdex writes hp 0 on Energy cards; the contract has no 0 HP, so it maps to null.
  hp: z.number().int().nonnegative().optional(),
  types: z.array(z.string()).optional(),
  stage: z.string().optional(),
  regulationMark: z.string().optional(),
});

const rawCardBriefListSchema = z.array(z.looseObject({ id: z.string().min(1) }));
const rawSetBriefListSchema = z.array(rawSetBriefSchema);

export type RawTcgdexCard = z.infer<typeof rawCardSchema>;

// ---- Mapping -----------------------------------------------------------------

// TCGdex localizes category and energy-type names per language. Names were
// recorded from /v2/{lang}/categories and /v2/{lang}/types on 2026-10-09
// (fixtures in test/fixtures/tcgdex/{lang}/); ja uses the English names.
// Keys are lower-cased; an unmapped name is a CatalogError, never dropped.

const ENGLISH_ENERGY_TYPES: Readonly<Record<string, EnergyType>> = {
  grass: "grass",
  fire: "fire",
  water: "water",
  lightning: "lightning",
  psychic: "psychic",
  fighting: "fighting",
  darkness: "darkness",
  metal: "metal",
  fairy: "fairy",
  dragon: "dragon",
  colorless: "colorless",
};

const ENGLISH_CATEGORIES: Readonly<Record<string, CardCategory>> = {
  pokemon: "pokemon",
  trainer: "trainer",
  energy: "energy",
};

const ENERGY_BY_TCGDEX_TYPE: Readonly<Record<CatalogLanguage, Readonly<Record<string, EnergyType>>>> = {
  en: ENGLISH_ENERGY_TYPES,
  ja: ENGLISH_ENERGY_TYPES,
  es: {
    planta: "grass",
    fuego: "fire",
    agua: "water",
    rayo: "lightning",
    "psíquico": "psychic",
    lucha: "fighting",
    oscura: "darkness",
    "metálica": "metal",
    hada: "fairy",
    "dragón": "dragon",
    incolora: "colorless",
  },
};

const CATEGORY_BY_TCGDEX: Readonly<Record<CatalogLanguage, Readonly<Record<string, CardCategory>>>> = {
  en: ENGLISH_CATEGORIES,
  ja: ENGLISH_CATEGORIES,
  es: {
    "pokémon": "pokemon",
    entrenador: "trainer",
    "energía": "energy",
  },
};

const lookupKey = (name: string) => name.normalize("NFC").trim().toLowerCase();

/** A TCGdex category name in `lang` → contract category; throws if unmapped. */
export function mapCategory(category: string, lang: CatalogLanguage): CardCategory {
  const mapped = CATEGORY_BY_TCGDEX[lang][lookupKey(category)];
  if (!mapped) throw new CatalogError(`Unknown TCGdex category "${category}" for language ${lang}`);
  return mapped;
}

/** TCGdex type names in `lang` → contract energy types; throws on an unmapped name. */
export function mapEnergyTypes(
  types: readonly string[] | undefined,
  lang: CatalogLanguage,
): EnergyType[] {
  const mapped = (types ?? []).map((t) => {
    const energy = ENERGY_BY_TCGDEX_TYPE[lang][lookupKey(t)];
    if (!energy) throw new CatalogError(`Unknown TCGdex energy type "${t}" for language ${lang}`);
    return energy;
  });
  return [...new Set(mapped)];
}

function mapFinishes(variants: RawTcgdexCard["variants"]): CardFinish[] {
  if (!variants) return [];
  const finishes: CardFinish[] = [];
  if (variants.normal) finishes.push("normal");
  if (variants.holo) finishes.push("holo");
  if (variants.reverse) finishes.push("reverse");
  if (variants.firstEdition) finishes.push("firstEdition");
  return finishes;
}

/** TCGdex writes "None" when a card has no printed rarity. */
function mapRarity(rarity: string | undefined): string | null {
  if (!rarity || rarity.trim().toLowerCase() === "none") return null;
  return rarity;
}

/**
 * Map one TCGdex card response to a validated `CardPrinting`. Only contract
 * fields are copied, so pricing and every other provider extra is dropped.
 * Throws `CatalogError` if the response does not fit the contract.
 */
export function mapTcgdexCard(
  raw: unknown,
  lang: CatalogLanguage,
  fetchedAt: string,
): CardPrinting {
  const parsed = rawCardSchema.safeParse(raw);
  if (!parsed.success) {
    throw new CatalogError(`Unexpected TCGdex card shape: ${parsed.error.message}`);
  }
  const card = parsed.data;
  let category: CardCategory;
  let energyTypes: EnergyType[];
  try {
    category = mapCategory(card.category, lang);
    energyTypes = mapEnergyTypes(card.types, lang);
  } catch (err) {
    throw err instanceof CatalogError ? new CatalogError(`${err.message} on ${card.id}`) : err;
  }
  const printing = cardPrintingSchema.safeParse({
    id: formatPrintingId(lang, card.id),
    provider: "tcgdex",
    providerCardId: card.id,
    language: lang,
    name: card.name,
    category,
    collectorNumber: card.localId,
    set: {
      id: card.set.id,
      name: card.set.name,
      officialCount: card.set.cardCount.official,
      totalCount: card.set.cardCount.total,
      releaseDate: card.set.releaseDate ?? null,
      symbolUrl: card.set.symbol ?? null,
      logoUrl: card.set.logo ?? null,
    },
    rarity: mapRarity(card.rarity),
    energyTypes,
    stage: card.stage ?? null,
    hp: card.hp && card.hp > 0 ? card.hp : null,
    dexNos: card.dexId ?? [],
    illustrator: card.illustrator ?? null,
    regulationMark: card.regulationMark ?? null,
    availableFinishes: mapFinishes(card.variants),
    imageUrl: card.image ?? null,
    fetchedAt,
  });
  if (!printing.success) {
    throw new CatalogError(`TCGdex card ${card.id} failed the contract: ${printing.error.message}`);
  }
  return printing.data;
}

// ---- Provider ----------------------------------------------------------------

/** Default transport: HTTPS GET against the public TCGdex API (no key). */
export function createTcgdexFetch(baseUrl: string = TCGDEX_BASE_URL): CatalogFetch {
  return async (path) => {
    let res: Response;
    try {
      res = await fetch(`${baseUrl}${path}`, { headers: { accept: "application/json" } });
    } catch {
      throw new CatalogError("Catalog unreachable — are we online?");
    }
    if (res.status === 404) return null;
    if (!res.ok) throw new CatalogError(`Catalog request failed (HTTP ${res.status})`);
    try {
      return await res.json();
    } catch {
      throw new CatalogError("Catalog returned an unreadable response");
    }
  };
}

/** Printed-number spellings to try: as given, without and with zero padding. */
export function collectorNumberVariants(collectorNumber: string): string[] {
  const trimmed = collectorNumber.trim();
  if (!/^\d+$/.test(trimmed)) return trimmed ? [trimmed] : [];
  const bare = String(Number(trimmed));
  return [...new Set([trimmed, bare, bare.padStart(3, "0")])];
}

/** `CardPrinting.id` for a TCGdex card: `"tcgdex:{language}:{providerCardId}"`. */
export function formatPrintingId(lang: CatalogLanguage, providerCardId: string): string {
  return `${ID_PREFIX}${lang}:${providerCardId}`;
}

/**
 * The TCGdex card id behind a printing id (`"tcgdex:es:swsh3-20"`) or a bare
 * provider card id (`"swsh3-20"`). A qualified id must name `lang`; any other
 * `tcgdex:`-prefixed form is rejected.
 */
export function providerCardIdFor(id: string, lang: CatalogLanguage): string {
  const trimmed = id.trim();
  if (!trimmed.startsWith(ID_PREFIX)) return trimmed;
  const [idLang, ...rest] = trimmed.slice(ID_PREFIX.length).split(":");
  const cardId = rest.join(":");
  if (!(CATALOG_LANGUAGES as readonly string[]).includes(idLang) || !cardId) {
    throw new RangeError(`Malformed printing id "${id}"`);
  }
  if (idLang !== lang) {
    throw new RangeError(`Printing id "${id}" is not in the requested language ${lang}`);
  }
  return cardId;
}
const seg = encodeURIComponent;

export interface TcgdexProviderOptions {
  fetchJson?: CatalogFetch;
  now?: () => Date;
  maxSearchResults?: number;
}

export function createTcgdexProvider(options: TcgdexProviderOptions = {}): CatalogProvider {
  const fetchJson = options.fetchJson ?? createTcgdexFetch();
  const now = options.now ?? (() => new Date());
  const maxSearchResults = options.maxSearchResults ?? DEFAULT_MAX_SEARCH_RESULTS;

  async function fetchCard(path: string, lang: CatalogLanguage): Promise<CardPrinting | null> {
    const raw = await fetchJson(path);
    return raw === null ? null : mapTcgdexCard(raw, lang, now().toISOString());
  }

  async function getPrinting(id: string, lang: CatalogLanguage) {
    const cardId = providerCardIdFor(id, lang);
    if (!cardId) return null;
    return fetchCard(`/${lang}/cards/${seg(cardId)}`, lang);
  }

  async function findByNumber(collectorNumber: string, setOfficialCount: number, lang: CatalogLanguage) {
    const numbers = collectorNumberVariants(collectorNumber);
    if (numbers.length === 0 || !Number.isInteger(setOfficialCount) || setOfficialCount < 1) return [];
    const query = new URLSearchParams({ "cardCount.official": `eq:${setOfficialCount}` });
    const sets = rawSetBriefListSchema.safeParse((await fetchJson(`/${lang}/sets?${query}`)) ?? []);
    if (!sets.success) throw new CatalogError("Unexpected TCGdex set list shape");

    const found = new Map<string, CardPrinting>();
    for (const set of sets.data) {
      for (const number of numbers) {
        const printing = await fetchCard(`/${lang}/sets/${seg(set.id)}/${seg(number)}`, lang);
        if (printing && printing.set.officialCount === setOfficialCount) {
          found.set(printing.id, printing);
          break;
        }
      }
    }
    return [...found.values()];
  }

  async function searchByName(name: string, lang: CatalogLanguage) {
    const trimmed = name.trim();
    if (!trimmed) return [];
    const query = new URLSearchParams({ name: trimmed });
    const briefs = rawCardBriefListSchema.safeParse((await fetchJson(`/${lang}/cards?${query}`)) ?? []);
    if (!briefs.success) throw new CatalogError("Unexpected TCGdex card list shape");
    const ids = briefs.data.slice(0, maxSearchResults).map((b) => b.id);
    const printings = await Promise.all(ids.map((id) => getPrinting(id, lang)));
    return printings.filter((p): p is CardPrinting => p !== null);
  }

  return { getPrinting, findByNumber, searchByName };
}
